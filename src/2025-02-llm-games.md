# Games for Large Language Models to play against themselves

So, self-play, that magical technique that allowed AlphaGo[^alphago] to soar past the best human players. Does it also work for language models?

Recently, chain-of-thought (CoT) based reinforcement learning (RL) self-improvement has shown remarkable promise, and self-play feels to me like the logical next step. And unsurprisingly, many people thought the same. Various ideas have been proposed, and I have read a handful of them, yet I believe the ideas I have are still novel. Well, I am not an AI researcher, in fact, I am not a researcher at all. So I could easily have missed something, and all of these have already been done, which would be fantastic! Because then I wouldn't have to do all the hard work myself to figure out all these don't actually work XD.

OK, before going straight into the games, let me give you an overview first.

## Problems with Self-Play in Language Models

Ultimately, Go is a simple game. The rules are relatively easy to learn, and when a game finishes, it's also easy to tell who has won and who has lost. And that's an important property for self-play, because it makes assigning the reward straightforward. This becomes tricky when designing games for language models.

It's very easy to make Language Models talk with themselves. But assigning a winner? That's difficult[^debate]. There is a reason why CoT-based RL only boosted models' ability in areas such as math and logic - because it's relatively easy to tell when math is wrong. So maybe we can use something similar[^vlmdialogue] for self-play too? Maybe, but it's hard to imagine why playing against an opponent will make you better at math - you don't see players battling it out at Math Olympiad, after all.

In summary, two criteria have to be met for an LLM game:
1. It must be easy to judge. You don't want to hire a million human labelers to score the billion games played by LLMs one-by-one. That'd be cost-prohibitive and also, inhumane.
2. It must make sense as a game. Generally speaking, it can't be something you can do by yourself. (Game of Life, sadly, is not a game[^0player]).

## The Games

I have two games. I said "games" in the title, but turns out I only have two. Here it goes:

### The Jailbreak Game

If you are familiar with AI, you know what jailbreaking is. But to re-cap: AI companies try to stop users from using their AIs to do certain things (for "safety", apparently🙄), users find ways around that using word magic, the end.

So, the jailbreak game is exactly the same thing. One side plays the defender, and is instructed to follow a rule; the other side plays the attacker, who will try to make its opponent break its rule. To meet criteria (1), rules must be simple and easy to judge, such as keeping a secret phrase and _not_ telling it to anyone, which can be judged simply by matching that secret phrase in the model's output.

### The Persuasion Game

This is simple: one side tries to persuade the other side to take its viewpoint. For any viewpoint, a game is played for either side of that viewpoint. (i.e. one for "A is true", another for "A is not true"). I divide the viewpoints into two categories:

1. **uncontroversial:** These are indisputable facts, for example, earth is a globe, sun is powered by fusion, 2+2=4, etc. For these viewpoints, both players are updated after each game, with rewards determined based on the outcome and the factuality of the assigned view point.
2. **controversial:** Everything not in (1). These are opinions, or results from unsettled research, etc. (not going to list any examples...)
   For these, the persuader is rewarded if it can successfully convince its opponent. And it will be rewarded even more if it can do the same for the opposite viewpoint. The persuadee is not updated for this case.

## Results?

Well, I don't have any. If someone has already done all these before, I'd love to know. Otherwise, give me GPU compute time and I figure it out somehow.

[^alphago]: [Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm](https://arxiv.org/abs/1712.01815)
[^vlmdialogue]: [Vision-Language Model Dialog Games for Self-Improvement](https://arxiv.org/abs/2502.02740)
[^debate]: [Training Language Models to Win Debates with Self-Play Improves Judge Accuracy](https://arxiv.org/abs/2409.16636)
[^0player]: [Zero-player game - Wikipedia](https://en.wikipedia.org/wiki/Zero-player_game)
