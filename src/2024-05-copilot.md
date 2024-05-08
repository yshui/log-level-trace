# Did GitHub Copilot really increase my productivity?

I had free access to GitHub Copilot for about a year, I used it, got used to it, and slowly started to take it for granted, until one day it was taken away. I had to re-adapt to a life without Copilot, but it also gave me a chance to look back at how I used Copilot, and reflect - had Copilot actually been helpful to me?

Copilot definitely feels a little bit magical when it works. It's like it plucked code straight from my brain and put it on the screen for me to accept. Without it, I find myself getting grumpy a lot more often when I need to write boilerplate code - "Ugh, Copilot would have done it for me!", and now I have to type it all out myself. That being said, the answer to my question above is a very definite "no, I am more productive without it". Let me explain.

**Disclaimer!** This article only talks about my own personal experiences, as you will be able to see, the kind of code I ask Copilot to write is probably a little bit atypical. Still, if you are contemplating if you should pay for Copilot, I hope this article can serve as a data point. Also, I want to acknowledge that generative AI is a hot-potato topic right now - Is it morally good? Is it infringing copyright? Is it fair that companies train their model on open source code then benefit from it? Which are all very very important problems. However please allow me to put all that aside for this article, and talk about productivity only.

OK, let me give you some background first. For reasons you can probably guess, I do not use Copilot for my day job. I use it for my own projects only, and nowadays most of my free time is spent on a singular project - [picom](https://github.com/yshui/picom), a X11 compositor, which I am a maintainer of. I am not sure how many people reading this will know what a "compositor" is. It really is a dying breed after all, given the fact X11 is pretty much at its end-of-life, and everyone is slowly but surely moving to wayland. Yes, each of the major desktop environments comes with its own compositor, but if you want something that is not attached to any DE, picom is pretty much the only option left. Which is to say, it is a somewhat "one of a kind" project.

Of course, as is the case with any software projects, you will be able to find many commonly seen components in picom: a logging system, string manipulation functions, sorting, etc. But how they all fit together in picom is pretty unique. As a consequence, large scale reasoning of the codebase with Copilot is out of the window. Since it has not seen a project like this during training, it's going to have a really hard time understanding what it's doing. Which means my usage of Copilot is mostly limited to writing boilerplates, repetitive code, etc. To give a concrete example, say you need to [parse an escaped character](https://github.com/yshui/picom/blob/311225be4d9187cbadf7388af87946d9fa62a924/src/c2.c#L1044):

```c
if (pattern[offset] == '\\') {
	switch (pattern[offset + 1]) {
	case 't': *(output++) = '\t'; break;
	// ????
	}
}
```

If you put your cursor at the position indicated by `????`, you can pretty reliably expect Copilot to write the rest of the code for you. Other examples include [mapping enums to strings](https://github.com/yshui/picom/blob/311225be4d9187cbadf7388af87946d9fa62a924/src/c2.c#L238), [write glue functions that have a common pattern](https://github.com/yshui/picom/blob/311225be4d9187cbadf7388af87946d9fa62a924/src/dbus.c#L1421), etc. In other words, the most simple and boring stuff. Which is very good. See, I am someone who wants programming to be fun, and writing these boring, repetitive code is the least fun part of programming for me. I am more than delighted to have someone (or rather, something) take it away from me. 

So, what is wrong then? Why did I say I am more productive without Copilot? Well, that's because Copilot has two glaring problems:

### **1. Copilot is unpredictable**
Copilot can be really really helpful when it gets things right, however, it's really difficult to predict what it will get right, and what it won't. After a year of working with Copilot, I would say I am better at that than when I first started using it, but I have yet to fully grasp all the intricacies. It is easy to fall into the trap of anthropomorphising Copilot, and trying to gauge its ability like you would a human. For instance, you might think, "Hmm, it was able to write that function based on my comments, so it must be able to write this too". But you are more than likely to be proven wrong by the chunk of gibberish Copilot throws at you. This is because, Artificial Intelligence is very much unlike Human Intelligence. The intuition you've developed through a lifetime's interaction with other humans, is not going to work with an AI. Which means, short of letting Copilot actually try, there is oftentimes no surefire way to know whether it's going to work or not. And this problem is compounded by the other big problem of Copilot:

### **2. Copilot is _slooooow_**
`clangd`, my C language server of choice, is very fast. It's faster than I can type, which means practically speaking, its suggestions are instant. Even when the suggestions are unhelpful, it costs me nothing. I don't have to pause, or wait, so my flow is uninterrupted. Compared to that, Copilot is much _much_ slower. I would wait at least 2~3 seconds to get _any_ suggestion from Copilot. If Copilot decided, for whatever reason, to write a large chunk of code, it would take a lot longer. Oftentimes, I would wait all those seconds only to see Copilot spit out unusable code. Then I would have to decide if I need to refine the instructions in comments and try again; or accept parts of the suggestion and do the rest of it myself. Even though this doesn't happen _that_ often, (after you have gotten to know Copilot a bit better), much time is wasted in the back-and-forth.

* * *
So yeah, that's pretty much all I have to say. At least at this very moment, I do not think Copilot will improve my productivity, so I definitely wouldn't be paying for it. If GitHub's plan was to give me a year's free access of Copilot to get me addicted, then their plot has conclusively failed. But that being said, if Copilot is a little bit smarter, or several times faster than it currently is, maybe the scale will tip the other way. 

Hmm, should I be scared? 
