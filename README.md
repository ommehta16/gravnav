# Gravnav
A little project I've been working on!

Uses A* graph traversal, the [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), express.js, hopes, dreams, and an INCREDIBLE amount of duct tape to show you Driving routes that (soon) get "subtly" attracted to nearby Chipotles

## Using
The latest public version is on <https://ommehta16.github.io/gravnav/>. Check it out if you're interested

## TODO
- [x] Re-implement the Chipotle gravity!s
- [ ] Move navigation to server-side
  - [ ] Store all node connections/times in a massive (<25GB though!) SQLite db
  - [ ] Just grab a new point from the db whenever A* wants a new node