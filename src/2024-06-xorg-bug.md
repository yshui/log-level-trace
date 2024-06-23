# I found an 8 years old Xorg bug

Let me set the right expectations first. This bug I found is actually not that complicated, it's very straightforward once you see what's going on. But I still think the process it took me to uncover this bug could be interesting. It's also kind of interesting that a simple bug stayed undiscovered for so long. I will speculate why that is later. Now let's start.

## The big X server lock

To give you some background, I was working on picom, the X11 compositor, when I encountered this problem. picom utilizes a X command, called `GrabServer`, which is essentially a giant lock that locks the entire X server.

Why do we need this? Well, that's because the X server is a terrible database, but that would take a long article to explain (let me know if you would like to read about that). To put it simply, picom needs to fetch the window tree from X. But there is no way to get the whole tree in one go, so we have to do this piece by piece. If the window tree keeps changing as we are fetching it, we will just get horribly confused. So we lock the server, then fetch the tree in peace.

And `GrabServer` is just the tool for that, quoting the X protocol specification:

> \[`GrabServer`\] disables processing of requests and close-downs on all connections other than the one this request arrived on.

Cool, until I found out that ...

## ... It doesn't work

I have a habit of putting assertions everywhere in my code. This way, if something is not going where I expected it to go, I will know. I would hate for things to quietly keep going and only fail mysteriously much later.

And that is how I found out something isn't right - windows that we know exist, suddenly disappear while we are holding the X server lock. Basically when a window is created, we receive an event. After getting that event, we lock the X server, then ask it about the new window. And sometimes, the window is just not there. How could this happen if the server is locked by us?

The first thing I did was to check the protocol again. Did I somehow misunderstood it? Unlikely, as the protocol is pretty clear about what `GrabServer` does. OK, does picom have a bug then? Did we somehow forget to lock the server? Did we miss a window destroyed event? I checked everywhere, and didn't really find anything.

This seems to lead to a single possible conclusion ...

## A Xorg bug?

It could be, though I didn't want to jump to conclusions that quickly. I want to at least figure out what was going on inside the X server when those windows were destroyed.

I could attach a debugger to the X server, however, debugging the X server pauses it, which would be a problem if I was debugging from inside that X session. Beside that, window destruction happens quite often, which can be prohibitive for manual debugging. It's still possible with a remote ssh connection, and gdb scripting, but it's inconvenient. 

The other option is modifying the X server and adding `printf`s to to print out logs when interesting things happen. That still feels like too much work.

Luckily, there is a better way to do this. It's called eBPF and uprobe. Essentially they let you run arbitrary code when your target program reaches certain points in code, without requiring modifying the program, or disrupting its execution.

Yeah, we live in the future now.

So, I hooked into `GrabServer`, so I can who is currently grabbing the server; then I hooked into window destruction to print a stack trace every time a window is destroyed. When everything was ready I set it off and collected the logs. At first there were a couple of false positives, because some applications do legitimately grab the server and destroy windows. But after a while, I saw something that stood out:

```
0x4755a0 DeleteWindow (window.c:1071)
0x46ef75 FreeClientResources (resource.c:1146) | FreeClientResources (resource.c:1117)
0x4450bc CloseDownClient (dispatch.c:3549)
0x5bfd12 ospoll_wait (ospoll.c:643)
0x5b8901 WaitForSomething (WaitFor.c:208)
0x445bb5 Dispatch (dispatch.c:492)
0x44a1bb dix_main (main.c:274)
0x729a77b6010e __libc_start_call_main (:0)
```

Aha, `CloseDownClient`! So the window is closed because a client disconnected? But I remember the protocol specification says

> ... disables processing of requests and **close-downs** ...

Oh yeah, this is indeed a Xorg bug! So what's going on here?

## A simple bug

Xorg server uses `epoll` to handle multiple client connections. When `GrabServer` is used, the server will stop listening for readability on all other clients besides the client that grabbed the server. This is all well and good, except for connection errors. When an error happens, `epoll` will notify the server even if it is not listening for anything. The `epoll_ctl(2)` man page says:

> **EPOLLERR**
> 
> Error condition happened on the associated file descriptor. This event is also reported for the write end of a pipe when the read end has been closed.
> 
> `epoll_wait(2)` will **always** report for this event; it is not necessary to set it in events when  calling `epoll_ctl()`.

Turns out, it's just a simple misuse of `epoll`. Checking the git logs shows this bug has been there for at least 8 years.

So how does a simple bug like this slip under the radar for so long? Actually, I think I might have the answer for this.

You see, a X11 compositor sits in a very special niche in the system. Normal applications only care about their own windows most of the time, so they only need to synchronize within themselves. And for window managers, well, they manage windows. They have the authority to decide when a window should be destroyed (well, most of the time). So there is no race condition there either. Only the compositor needs to know about all windows, yet doesn't have a say on when they are closed. So it's in a unique position that made using the big X server lock necessary.

Besides that, this problem rarely happens despite picom's heavy use of the lock. I was only able to trigger it by installing .NET Framework on Linux using Wine. (I will not explain why I was doing that.)

## Conclusion

I actually don't have much more to say. Hopefully you found this little story interesting. I definitely recommend learning about eBPF and uprobe. They are amazing tools, and have a lot more uses beyond just debugging.

* * *

**Additional note 1:** Despite me claiming it is necessary to use the server lock in picom, there might be a way of updating the window tree reliably without it. I do want to get rid of the lock if I can, but I am still trying to figure it out.
