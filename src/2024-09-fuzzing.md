# Fuzzing an X compositor

## Background

~~~admonish warning
X11 rant incoming.
~~~

I don't know if you know this, but X programming is not fun.

To start off, interactions with the X server are inherently racy. Let me give you an example. Say, you receive an event telling you that a window has been created. You are interested in what properties are set on new windows, so you send out a request for that. Because everything happens concurrently, when your request has arrived at the server, the window might have already been destroyed, and you get an error.

OK, this one doesn't sound too bad. You look at the error, deduce the window must have been destroyed, and move on. But this same problem applies to literally _everything_ you do with the X server. And X has tens of different kinds of objects - some of which have very complex relationships with each other, and hundreds of ways to manipulate them. And every time you do something, you have to consider what you would need to do if anything changed due to a race condition, how you would detect such a change, how to tell race conditions and real errors apart... The list just goes on and on.

What's worse, is the libraries I need to use to interact with the server weren't really designed with these kinds of considerations in mind. For one thing, they encourage you to handle server messages out-of-order. Continue from the example above, with Xlib, the function that lets you get properties from a window is `XGetProperty`. What happens internally when it is called, is that it will send a `GetProperty` request, then it will block until a reply for that request is received, finally it returns the reply back to you. Blocking I/O aside, this doesn't look too bad. Until you realize, the reply might not be the immediate next thing you get from the server - any events received before the reply, will be skipped over. You will be processing the reply first, despite it actually coming _after_. What if it's an event telling you the property you were trying to get has changed? OK, you figured out what's the correct thing to do in this case, now you just need to figure out the rest of the hundreds of cases. What would be more logical is to handle all messages in the order they come, regardless if they are replies or events. But it is very difficult to do this with either of the two first-party libraries (Xlib and libxcb), if not outright impossible.

Hold on, you might say, for a concurrent program like this, surely there are some synchronization primitives I can use to make this easier? Well, yeah. X does have this _global lock_, which lets you block _everyone else_. Which is already a [bad](https://en.wikipedia.org/wiki/Giant_lock) [start](https://en.wikipedia.org/wiki/Global_interpreter_lock). You know what's worse? It doesn't even work! Because of a [bug](2024-06-xorg-bug.html), holding the global lock doesn't fully prevent the server state from changing! It's useless!

Does this sound bad enough? Well, there is more. picom, as you may know, is an X compositor, which puts your windows on your screen in a slightly more eye-candy fashion, which means it needs to know what windows there are. Seems like an easy enough task, surely I can just ask the X server for a list of all windows? Wrong, you have to query the server _one window at a time_. And remember, as you are doing this, windows are constantly coming and going, moving around in the window tree! That already sounds like a problem, but let's assume there is a way to do that. Now, you also have to monitor the window tree for any future changes - users will get confused if they open a new window and it doesn't show up. Is it possible to ask the server to send you events every time the window tree changes? Of course not! You can only ask for events from each individual window. If a new window is created and you haven't got a chance to enable events for it, you will have no idea if any new child window is created under it!

You think that's all? But there is still more! Do you know that the X server _actively_ reuses its IDs? Yeah, if a window is destroyed, another window could be created with the same ID immediately after. So you see a window created, you send a request to fetch some information from it, what you get back could be from a completely different, unrelated window! How cool is that!?!?

Sorry, I was losing my mind a little bit. At some point, you just start to feel all this is just impossible. But I eventually managed to find a way. As you can guess, it takes a very complex algorithm to handle all the intricacies mentioned above. Which means the likelihood that I didn't make any mistakes, is practically zero. Unfortunately, as it normally is with any concurrent program, testing and debugging it is going to be extremely difficult. So how will I be able to make sure everything won't blow up after I ship this code?

## Fuzzing!

Yeah, sure, fuzzing. Just throw every possible scenario at picom and see if it crashes, right? But it's not that simple. While it is possible to run picom with the X connection as its sole source of input, I can't just feed it random data through that connection. Generally speaking, we do trust the X server to not send us malformed data. If we really want to fuzz picom at this level, we need to convincingly mimic the behavior of the X server, which would be way too much work.

Here, what we want to test is the part of picom that replicates the window tree from the X server. So it would be much better if I can strip out this part of picom and test it separately. The code base picom inherited from compton isn't in a state where this is possible, but I need to implement the new tree replication algorithm anyway. This would be a great opportunity to refactor the code base to make it more compartmentalized. 

### Turning it inside-out

Here, there is an interesting design pattern I want to talk about. As I was making the tree replication code more independent, eventually I needed to design some kind of interface between the tree replication and the rest of picom. To see what I mean, consider the case where a new application window is added to the tree, the tree replication code needs to inform picom about this so it can set up this window for rendering. Doing it naively, it might look something like this:

```c
void tree_handle_new_x_event(context, x_event) {
    // ...
    if (x_event is new window) {
	    // `context` holds necessary compositor states - we try to
	    // avoid global variables
        picom_setup_window(context, x_event.window);
    }
    // ...
}
```

Which is fine. But `picom_setup_window` would involve much of the code we aren't testing, so it must be stubbed out for fuzzing. And there could be many more cases like this.

This is one way to do it, and it does work. I don't like this, because I feel it's too easy for extra dependencies to creep in. And it's difficult to tell what external dependencies there are out of a glance. It's also annoying to carry a `context` argument everywhere, even in functions that don't use it directly - just because it transitively calls an external function.

The way I usually prefer, is turning the whole thing inside-out:

```cpp
TreeActions tree_handle_new_x_event(x_event) {
	TreeActions return_value;
    // ...
    if (x_event is new window) {
	    return_value = TreeActions::SetupWindow;
    }
    // ...
    return return_value;
}
```

This way, the tree replication code can be entirely self-contained. The only input is through function arguments, and the only output is function return values. All the actions the caller needs to support can all be found in one place. And there is no infectious `context` parameter needed.

I don't know if this is an established pattern, or what it is called. (Please let me know if it has a name!) But since I learned about algebraic effects, I started to think this is just poor-programmer's algebraic effects. I hope you can see it too - `TreeActions` is the "effect" of `tree_handle_new_x_event` which the caller must handle. Except you can't do any of the nice things you can do with a real effect system :'( 

Anyway, I won't say this is always the best approach. But I think this is definitely a design pattern worth considering for doing things like this.

### Making the test harness

After all the refactoring is done, and the tree replication code isolated, there are 4 X requests left[^requests] that we still need to (partially) support. Considering this number would likely be in the hundreds otherwise, this is not too bad. But this does mean I needed to re-implement (a tiny) part of the X server for the test harness. I essentially needed to maintain a window tree - just the basic stuff.

But more importantly, the test harness also has to model the concurrency of the X server. This is what we set out to test, after all. This is a bit more tricky, I had to simulate the incoming and outgoing message queues, and randomly interleaved message deliveries with all the other processing.

And that's it! Now we are ready to fuzz picom!

### Results

I was expecting to see some bugs going in, but I didn't expect how many bugs I was actually going to get. One after another, the fuzzer uncovers race conditions I forgot to consider, which just goes to show how difficult it is to do X programming correctly. Eventually, I managed to fix all the bugs found - some of which required significant design changes, and the fuzzer can now run for days without finding any failures.

So I guess now I can say with reasonable confidence that picom's window tree code is bug free!

## Conclusion

First of all, X11 sucks. This might make some people mad, but this is a fact. If you are wondering, yes, wayland does solve _all_ of the problems mentioned above. If you see developers leaving X for wayland, things like this are the reason why.

Fuzzing is an incredibly powerful tool for uncovering bugs. But only certain kinds of codebases are fuzzable. It is already an accepted fact that it is good practice to modularize and decouple your code. Now, you can add fuzzability to the long list of reasons why you should do that.

Besides fuzzing, I also looked into symbolic execution and model checking for this problem. Compared to fuzzing, I feel they are much less explored. Information on how to use them is more limited, and quality of the documentation for the [few](https://www.cprover.org/cbmc/) [tools](https://klee-se.org/releases/docs/v3.1/docs/) [that exist](https://github.com/quarkslab/tritondse) is generally poor. While I managed to get the tools to work, they unfortunately didn't yield much useful results.


[^requests]: These are: `QueryTree`, `ChangeWindowAttributes` (for event mask changes only), `GetWindowAttributes`, and `GetProperty` (for `WM_STATE`).
