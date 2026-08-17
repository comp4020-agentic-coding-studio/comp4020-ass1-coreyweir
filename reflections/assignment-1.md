# Reflection

## 1. What was the breakthrough that moved the work forward?

The breakthrough was realising that the best approach was just to produce some mock-up images to guide Claude on what I was after.
I had a strong sense of what I wanted the site to look like and what I wanted the experience to be, but converting that into a prompt
Claude was able to follow was proving challenging. So I used Gemini to produce a mock-up to get the title styling right, and the subtitles.
Then once I was happy with the main page design and UX, I produced mock-ups for the presentation of the content itself and the UX. I started with
Gemini, then moved to ChatGPT; ChatGPT had most of what I was after across the range of mock-ups it produced, but never combined. So I opened GIMP
and constructed the mockdowns for all 3 annotation states (collapsed, on-hover, expanded) myself using pieces of the mock-ups and a screenshot of
the current site. Providing that to Claude was enough for it to perfectly replicate the experience first try, with subsequent iterations being
relatively small tweaks.

Before I switched to using mock-ups, the site looked like this:
![Before Mockups](./before.png)
After pointing Claude to the first mock-up, the site looked like this:
![After First Mockup](./after-1.png)
After pointing Claude to the final set of mock-ups, the site looked like this:
![After Final Mockups](./after-2.png)

## 2. What did this work change about who I want to be as a software developer?

This work made me want to take more of an active and considered role in design and UI/UX. I've always considered myself to be relatively poor at
design work, and one of the big benefits of AI for me is that it allowed me to make web UIs that didn't look awful without resorting to the 'keep it as
minimalist as possible' principle. This work was the first time I really worked on mocking up a design to get it exactly how I wanted it and then used AI
to implement it, and I liked that flow. I'm not a great visual thinker, so while I've often mocked up 'rough positioning' of elements, figuring out the specific
design I'm after instead of just the *vibe* of what I want hasn't been easy for me. The flow I utilised here—mocking up rough positioning in ASCII art, getting a basic
prototype, using image generation to produce mock-ups until I land on the specific design features I want, then combining those features by hand to get mock-ups of a design
I'm truly happy with, and then using AI to execute on that design and convert the mock-ups into a working product—seems really promising to me.
