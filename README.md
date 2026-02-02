# Gravnav
*maximize burritos*

## How do I use it?
Gravnav is now **public**! You can mess around with it at [ommehta16.github.io/gravnav](https://ommehta16.github.io/gravnav)!

[gif goes here]

The UI is pretty minimal, so using it is really simple. Just **click on two points** on the map, then wait for the map to calculate a route! You'll get a progress indicator at the bottom, then a route summary in the "main panel" in the top left once it's done loading.

When you initially load the site, it will take a few seconds to load in all the map chunks. Navigation data is only loaded within the black-outlined rectangle (so that RAM usage doesn't go through the roof). Loaded chunks are tinted green; unloaded chunks within the rectangle are their normal color; the chunk that is currently loading is orange.

Once the map is loaded, the **will** use a not-insignificant amount of memory on your machine. This is just a byproduct of the "split work" architecture I used! More on this in ["How does it work?"](#how-does-it-work), but TL;DR: about 10% of the points that define the lines are needed on **your machine**, since its the one calculating the route.

## What is GravNav?

A little project I've been working on!

Uses A* graph traversal, the [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), express.js, hopes, dreams, and an INCREDIBLE amount of duct tape to show you driving routes that get "subtly" attracted to nearby Chipotles

## How does it work?
I'll write more here soon!

## Running GravNav

As is, you just need to open [`index.html`](/index.html) in your browser of choice. By default, the app's configured to use *my* droplet ([api.gravnav.ommehta.us](https://api.gravnav.ommehta.us/hello)) to find, process, cache, and send map data.

If opening `index.html` doesn't cause chunks to start loading, it's likely because your browser/computer is being *silly* (or just has extra, non-standard protections in place for straight html files!).

In this case, I've included [`silly-server.py`](/silly-server.py). If you'd like to run it this way, ensure that you have Python>3.13. Then run:
```bash
python3 -m pip install flask; python3 silly-server.py
```

Then you should be able to load gravnav on [`localhost:3000`](http://localhost:3000)

### Self-hosting

The backend is just a single, simple(ish) express.js server. I have it set up on a 2GB DigitalOcean droplet, but really any machine with >1GB of RAM should be able to handle it.

To run it, ensure you have node.js>24 and npm>11.8.0 installed, then
```bash
npm i; node server.js;
```
You can then quit the server with ^C, and force quit it with another ^C!

If you'd like to run it in a production-y environment, I'd recommend using [pm2](https://pm2.keymetrics.io). Check out [their docs](https://pm2.keymetrics.io/docs/usage/quick-start/) for more information on using it!

You can also get set up with a remote proxy! The nginx config for the server is in [`/nginx/gravnav.conf`](/nginx/gravnav.conf); just include it in your main `nginx.conf` file, change it to your needs, start nginx, and you should be good to go!

-----
In any case, though, if you're self-hosting, you'll need to **change the backend URL in `getdata.js`**. Just set `OSM_API_URL` to the url of your server, and you're good to go!

*<small>Note: I used [node](https://nodejs.org/en) in all of the above examples, but everything **should** run just as fine on [bun](https://bun.com): this is as-of-yet untested though!</small>*
## TODO
- [ ] Make the top-left panel look nicer!