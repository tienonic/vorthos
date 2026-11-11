# Vorthos

A gallery of every unique piece of Magic: The Gathering card art. Browse by colour, mood, subject, year and artist. The art is the point; card stats and rules text are left out.

Live site: https://vorthos.vercel.app

## What is here

- `web/` is the site: Next.js static export, React, TypeScript and Tailwind. See `web/README.md` to run and build it.
- `pipeline/` builds the data: it reads Scryfall's unique-artwork file, works out each artwork's colours, moods and subject, and writes the files in `web/public/data/`. See `pipeline/README.md`.
- `docs/data-contract.md` describes those data files.

Moods and subjects come from an image model, not from people, so some labels will be wrong. They are there to help you browse.

## Credits

Card data and images come from [Scryfall](https://scryfall.com). Each artwork is credited to its artist.

Vorthos is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
