# Python Playground

Interactive Python playground that runs Python code directly in your browser using Pyodide (WebAssembly).

## Features

- 🐍 Run Python 3 code in the browser
- 📝 Multiple example programs included
- ✏️ Custom code editor
- 🎨 Beautiful, responsive UI
- ⚡ Fast execution (WebAssembly)

## Example Programs

- Hello World
- Simple Calculator
- Fibonacci Sequence
- List Operations
- String Manipulation
- Dictionary Demo

## Adding Your Own Programs

Edit `assets/script.js` and add to the `examplePrograms` object:

```javascript
'my-program': {
  name: 'My Program Name',
  code: `print("Hello from my program!")
# Your Python code here`
}
```

## Deployment

Deploy to Cloudflare Pages:

```bash
cd python-playground
wrangler pages deploy . --project-name python-playground
```

Or use the deployment script from the root directory.

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac) - Run code

## Limitations

- Some Python standard library modules may not be available
- File I/O is limited
- Network requests are restricted
- Performance may be slower than native Python

## Technology

- [Pyodide](https://pyodide.org/) - Python in the browser via WebAssembly
- Shared components from `supm3n.com/shared/`

