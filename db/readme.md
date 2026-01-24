# Storage Format
This is a *very temporary* "innovative lightweight noSQL database"

SQL is non-trivial to add; In it's place, we have this goofy aah format.
- `[hash].json` is the Overpass API response's important bits for a request with hash \[hash\]
- `../hashes.json` is just a JSON-list of all the hashes in the db

Whenever we need 