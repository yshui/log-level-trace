# Go debug your core dumps somewhere else

<div class="toc">

<!-- toc -->

</div>

Have you ever had this happen to you? you caught your code crashing in CI, which gave you a core dump. So you downloaded this core dump and tried to debug it, but all you got was this:

```
(gdb) bt
#0  0x00005651f0f09c00 in ?? ()
#1  0x00005651f0ed774e in ?? ()
#2  0x00005651f0ee3ada in ?? ()
#3  0x00005651f0ee41e4 in ?? ()
#4  0x00007f2b654c124a in ?? ()
#5  0x0000000000000000 in ?? ()

:'(
```

If this is you, I have good news for you.

## Um, actually

Oh I _know_ what you are going to say. The reason I was getting this is because I don't have all the shared library files on the machine I tried to debug it on, right? So what I need to do is to figure out what shared library files were loaded by the program, copy them back, and make gdb load them somehow.

To find out what libraries are loaded, I need to attach gdb to the core file, and list them (`info proc mappings`). Then, I need to copy them while maintaining the relative directory structure (e.g. `/usr/lib/libc.so` needs to be copied to `/tmp/coredump_storage/usr/lib/libc.so`). And finally, when you load the core file, you need to ask gdb to load libraries from a different path with a combination of `set sysroot` and/or `set solib-search-path`.

This sounds like a reasonable solution. But I don't want to manually do all these every time something crashes. Besides, not all CI platforms support connections to the CI machine, even when they do, they usually require the build to be run again with SSH enabled. By that time, the crash could be gone if it is not deterministic. 

So, all these have to be automated. Maybe I could've made it work with a hacky shell script that parses text output from gdb, and use a `.gdbinit` script so I don't need to set `sysroot` manually every time. For a reasonable person, that might be good enough.

But I am not a reasonable person.

## Here we go

So, this is how my thought process went: gdb knows what libraries are loaded, so that information must be stored in the core dump somewhere and I just need to write a program to find it. And if my program was able to find it, it can't take that much extra work to modify it to point to somewhere else.

yeah... about that.

### So where is it actually stored?

A core dump file is actually just a normal ELF file. So the natural thing to do first is look at it with `readelf`. And I was excited to see this within the outputs:

```
  CORE                 0x0000331c       NT_FILE (mapped files)
    Page size: 4096
                 Start                 End         Page Offset
    0x00005603fa4fa000  0x00005603fa526000  0x0000000000000000
        /tmp/workspace/build/src/picom
    0x00005603fa526000  0x00005603fa5d4000  0x000000000000002c
        /tmp/workspace/build/src/picom
    0x00005603fa5d4000  0x00005603fa605000  0x00000000000000da
        /tmp/workspace/build/src/picom
    0x00005603fa605000  0x00005603fa614000  0x000000000000010a
        /tmp/workspace/build/src/picom
    0x00005603fa614000  0x00005603fa62e000  0x0000000000000119
        /tmp/workspace/build/src/picom
    0x00007f7b87d05000  0x00007f7b87d0a000  0x0000000000000000
        /usr/lib/x86_64-linux-gnu/libgpg-error.so.0.33.1
    0x00007f7b87d0a000  0x00007f7b87d20000  0x0000000000000005
        /usr/lib/x86_64-linux-gnu/libgpg-error.so.0.33.1
    0x00007f7b87d20000  0x00007f7b87d2b000  0x000000000000001b
        /usr/lib/x86_64-linux-gnu/libgpg-error.so.0.33.1
    0x00007f7b87d2b000  0x00007f7b87d2c000  0x0000000000000025
        /usr/lib/x86_64-linux-gnu/libgpg-error.so.0.33.1

...
```

That's a list of all the shared libraries and where in memory they were mapped! It couldn't be this easy, could it?

And as it turned out, no, it couldn't.

I wrote a program to parse the core dump and look for this `NT_FILE` component, copy those files, and modify the core dump so the paths would point to where I want them to be. I tried it, it did not work. Frustratingly, gdb is still trying to look for the library files where they originally were, for some reason. 

I could have stopped here. I already have a program that could automatically copy the libraries for me, and doing a `set sysroot` in gdb really isn't that bad. But at this point, my curiosity was piqued, and I must find out what is actually going on.

### Debugging the debugger

I look at the core dump file again with a hex editor, and indeed, there are still paths to the original library file scattered around. But unlike `NT_FILE`, this time there seems to be no structure to it. Those paths are just... there.

How was the debugger able to find them then? I tried to read the code, but as you would expect, `gdb` does not have the easiest code base to get into. `lldb` is a little better, but I still didn't know where to start.

So I attached a debugger, to the debugger. (I just think this is funny to say.)

I want to give `lldb` praise, for how amazingly detailed its logs are. I was barely able to get anything out of `gdb`, on the other hand `lldb` literally tells you about every single little thing it does. With the help of that, and a debugger, I was finally able to narrow it down.

### Rendezvous with the dynamic linker

Now, we are going to take a little detour. You see, finding out what libraries are loaded isn't just a problem when you analyze a core dump. The debugger needs to be informed about that when they debug a live program too. There is no syscall for loading a library (there _was_ one, long story), it's all done in user space by something called the dynamic linker, which just opens the file and maps it into memory. So how could the debugger know when this happens? It couldn't just set a breakpoint in the dynamic linker, right?

As it turned out, yeah it totally could. There is such a thing called the "dynamic linker rendezvous" struct, that is located in a predefined location in memory. In it, there is a field `r_brk`, which is the memory location where the debugger should put a breakpoint. The breakpoint is usually an empty function, which the linker calls every time it is about to load a library. Whenever that breakpoint is hit, the debugger knows a new library is loaded.

This feels like a hack, doesn't it. Well, when a hack becomes the standard, it is no longer a hack anymore.

This is fascinating, but how is this related to what we wanted to do? So, how does the debugger know _what_ has just been loaded when the breakpoint is hit? The answer is that there is another field, `r_map`, in the rendezvous struct, which is a linked list of all the libraries currently loaded.

And that's exactly what we need.

### Welcome back

OK, so now we know how to find loaded libraries in a live program, how is this related to debugging a core dump?

Well you see, what is a core dump, but a complete dump of the program's memory at the point of crash. Which is to say the rendezvous struct is dumped too. And all the debugger has to do, is pretend the core dump is just another live program, and read the `r_map` linked list from its "memory".

And all _we_ have to do, is to expand the program's "memory" with a copy of this linked list, but with all the paths rewritten with the ones we want, then point the rendezvous struct to the linked list we just created.

## Conclusion

Voilà! We've done it. I tested this with `gdb` and `lldb`, and it works. I now have a [little tool](https://github.com/yshui/coredump-copy) that automatically copies shared libraries from a core dump, as well as updates the core dump file to look up these libraries from their new paths. Now I can debug core dumps on another machine without worrying about setting `sysroot`! How cool is that?

Is this all worth it. To be honest, probably not. But at least I have learned how the dynamic linker talks with the debugger. And now you have too!
