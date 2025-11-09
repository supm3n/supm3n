# How to Add Your Python Programs

## Quick Guide

1. Open `python-playground/assets/script.js`
2. Find the `examplePrograms` object (around line 8)
3. Add your program like this:

```javascript
'my-program-key': {
  name: 'Display Name',
  code: `# Your Python code here
print("Hello from my program!")

def my_function():
    return "This is my function"

result = my_function()
print(result)
`
}
```

4. The program will automatically appear in the dropdown!

## Example: Adding a Number Guessing Game

```javascript
'number-guess': {
  name: 'Number Guessing Game',
  code: `import random

def number_guessing_game():
    number = random.randint(1, 100)
    attempts = 0
    max_attempts = 7
    
    print("I'm thinking of a number between 1 and 100!")
    print(f"You have {max_attempts} attempts. Good luck!")
    
    while attempts < max_attempts:
        try:
            guess = int(input(f"Attempt {attempts + 1}: Enter your guess: "))
            attempts += 1
            
            if guess == number:
                print(f"🎉 Congratulations! You guessed it in {attempts} attempts!")
                return
            elif guess < number:
                print("Too low! Try again.")
            else:
                print("Too high! Try again.")
        except ValueError:
            print("Please enter a valid number!")
    
    print(f"Game over! The number was {number}")

# Note: input() doesn't work in browser, so this is a demo
# For interactive input, you'd need to modify the code
print("Number Guessing Game Demo")
print("(Interactive input not available in browser version)")
`
}
```

## Tips

- **Keep code simple**: Complex programs with file I/O or network requests won't work
- **Use print()**: This is the main way to show output
- **Test locally**: Make sure your Python code works in regular Python first
- **Add comments**: Help users understand what your program does

## What Works

✅ Basic Python syntax
✅ Functions and classes
✅ Lists, dictionaries, sets
✅ Math operations
✅ String manipulation
✅ Most standard library modules (math, random, datetime, etc.)

## What Doesn't Work

❌ File I/O (open(), read(), write())
❌ Network requests (requests, urllib)
❌ Interactive input (input() - will hang)
❌ Some system-specific modules
❌ GUI libraries (tkinter, pygame)

## Need Help?

Check the Pyodide documentation: https://pyodide.org/

