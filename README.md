# Authenticator

A small two-factor authenticator app, the kind that shows a new 6-digit code every 30 seconds. It's written in plain HTML and JavaScript, with Tailwind CSS for styling.

## Running it

You need Python 3 (already installed on macOS and most Linux systems) and an internet connection, because Tailwind loads from a CDN.

1. Clone or download this repository and open a terminal in the project folder.
2. Start a local web server:

   ```bash
   python3 -m http.server 8080
   ```

   Or, if you have Node.js: `npm start`

3. Open these in your browser:
   - The app: <http://localhost:8080/>
   - The playground: <http://localhost:8080/playground.html>

Use `localhost`, not a file path. The app needs a web server and won't work if you double-click `index.html`.
