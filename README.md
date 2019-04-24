# Chessbored
Chessbored is a chessboard component.

This is currently just a heavy-handed TypeScript conversion of the chessboard.js component by Chris Oakman, available at [chessboardjs.com].
The api is almost identical, but will change over time.

## Installation
```
npm install chessbored
```

## Development
This repository contains the main library and basic web project for testing the component.

Install dependencies and link library and the web project.
```
<root>\npm run bootstrap
```

To build (and watch) the library:
```
packages\library\npm run watch
```

To launch the website with chessbored library linked:
```
packages\website\npm run start
```

## Todo 
- Add screenshots.
- Link to website.
- Look into removing jQuery, lodash and dependencies.
- Refactor. A bunch of code can be simplified.
- Rework css. The unique classname stuff should go.
- Add overlay layer for drawing things like move-arrows.
- Can we clean up the config element? It's pretty big.
- Look at issues & pull requests for chessboard.js for further improvements.