// ============================================
// Python Playground - Run Python in Browser
// ============================================

let pyodide = null;
let programs = {};

// Example Python programs
const examplePrograms = {
  'hello-world': {
    name: 'Hello World',
    code: `print("Hello, World!")
print("Welcome to Python Playground!")`
  },
  'calculator': {
    name: 'Simple Calculator',
    code: `def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        return "Error: Division by zero"
    return a / b

# Test the calculator
print("Calculator Functions:")
print(f"10 + 5 = {add(10, 5)}")
print(f"10 - 5 = {subtract(10, 5)}")
print(f"10 * 5 = {multiply(10, 5)}")
print(f"10 / 5 = {divide(10, 5)}")
print(f"10 / 0 = {divide(10, 0)}")`
  },
  'fibonacci': {
    name: 'Fibonacci Sequence',
    code: `def fibonacci(n):
    """Generate Fibonacci sequence up to n terms"""
    sequence = []
    a, b = 0, 1
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence

# Generate first 10 Fibonacci numbers
fib = fibonacci(10)
print("Fibonacci Sequence (first 10 numbers):")
print(fib)
print(f"\\nSum: {sum(fib)}")`
  },
  'list-operations': {
    name: 'List Operations',
    code: `# Create a list of numbers
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

print("Original list:", numbers)
print(f"Sum: {sum(numbers)}")
print(f"Average: {sum(numbers) / len(numbers):.2f}")
print(f"Max: {max(numbers)}")
print(f"Min: {min(numbers)}")

# Filter even numbers
evens = [n for n in numbers if n % 2 == 0]
print(f"\\nEven numbers: {evens}")

# Square each number
squares = [n**2 for n in numbers]
print(f"Squares: {squares}")`
  },
  'string-manipulation': {
    name: 'String Manipulation',
    code: `text = "Python Playground"

print(f"Original: {text}")
print(f"Uppercase: {text.upper()}")
print(f"Lowercase: {text.lower()}")
print(f"Reversed: {text[::-1]}")
print(f"Word count: {len(text.split())}")
print(f"Character count: {len(text)}")

# Count vowels
vowels = 'aeiouAEIOU'
vowel_count = sum(1 for char in text if char in vowels)
print(f"Vowel count: {vowel_count}")`
  },
  'dictionary-demo': {
    name: 'Dictionary Demo',
    code: `# Create a dictionary
student = {
    "name": "Alice",
    "age": 20,
    "grades": [85, 90, 88, 92, 87]
}

print("Student Information:")
for key, value in student.items():
    print(f"{key.capitalize()}: {value}")

# Calculate average grade
avg_grade = sum(student["grades"]) / len(student["grades"])
print(f"\\nAverage Grade: {avg_grade:.2f}")

# Add new information
student["major"] = "Computer Science"
print(f"\\nUpdated: {student}")`
  }
};

// Initialize Pyodide
async function initPyodide() {
  const loadingEl = document.getElementById('loading');
  const statusEl = document.getElementById('status');
  
  try {
    loadingEl.classList.remove('hidden');
    statusEl.textContent = 'Loading Pyodide...';
    
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
    });
    
    // Set up stdout/stderr capture
    pyodide.runPython(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.buffer = StringIO()
    
    def write(self, s):
        self.buffer.write(s)
    
    def flush(self):
        pass
    
    def getvalue(self):
        return self.buffer.getvalue()
    
    def clear(self):
        self.buffer = StringIO()

stdout_capture = OutputCapture()
stderr_capture = OutputCapture()
sys.stdout = stdout_capture
sys.stderr = stderr_capture
    `);
    
    loadingEl.classList.add('hidden');
    statusEl.textContent = 'Ready';
    document.getElementById('run-btn').disabled = false;
    
    console.log('Pyodide loaded successfully');
  } catch (error) {
    console.error('Failed to load Pyodide:', error);
    statusEl.textContent = 'Error loading Pyodide';
    loadingEl.classList.add('hidden');
    showOutput('Error: Failed to load Pyodide. Please refresh the page.', 'error');
  }
}

// Run Python code
async function runPython(code) {
  if (!pyodide) {
    showOutput('Error: Pyodide not loaded yet. Please wait...', 'error');
    return;
  }
  
  const statusEl = document.getElementById('status');
  const outputEl = document.getElementById('output');
  
  if (!code.trim()) {
    showOutput('Please enter some Python code to run.', 'info');
    return;
  }
  
  try {
    statusEl.textContent = 'Running...';
    outputEl.innerHTML = '';
    
    // Clear previous output
    pyodide.runPython('stdout_capture.clear(); stderr_capture.clear()');
    
    // Run the code
    pyodide.runPython(code);
    
    // Get output
    const stdout = pyodide.runPython('stdout_capture.getvalue()');
    const stderr = pyodide.runPython('stderr_capture.getvalue()');
    
    if (stderr) {
      showOutput(stderr, 'error');
    } else if (stdout) {
      showOutput(stdout, 'success');
    } else {
      showOutput('Code executed successfully (no output)', 'info');
    }
    
    statusEl.textContent = 'Ready';
  } catch (error) {
    statusEl.textContent = 'Error';
    showOutput(`Error: ${error.message}`, 'error');
    console.error('Python execution error:', error);
  }
}

// Display output
function showOutput(text, type = 'success') {
  const outputEl = document.getElementById('output');
  const pre = document.createElement('pre');
  pre.className = `output-${type}`;
  pre.textContent = text;
  outputEl.appendChild(pre);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// Clear output
function clearOutput() {
  document.getElementById('output').innerHTML = '';
}

// Load programs into dropdown
function loadPrograms() {
  const select = document.getElementById('program-select');
  programs = examplePrograms;
  
  // Add example programs to dropdown
  Object.entries(programs).forEach(([key, program]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = program.name;
    select.appendChild(option);
  });
}

// Handle program selection
function handleProgramSelect(value) {
  const editor = document.getElementById('code-editor');
  
  if (value === 'custom') {
    editor.value = '';
    editor.placeholder = '# Write your Python code here...';
  } else if (value && programs[value]) {
    editor.value = programs[value].code;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('run-btn');
  const clearBtn = document.getElementById('clear-btn');
  const clearOutputBtn = document.getElementById('clear-output-btn');
  const programSelect = document.getElementById('program-select');
  const codeEditor = document.getElementById('code-editor');
  
  // Load programs
  loadPrograms();
  
  // Initialize Pyodide
  initPyodide();
  
  // Event listeners
  runBtn.addEventListener('click', () => {
    runPython(codeEditor.value);
  });
  
  clearBtn.addEventListener('click', () => {
    codeEditor.value = '';
    clearOutput();
  });
  
  clearOutputBtn.addEventListener('click', () => {
    clearOutput();
  });
  
  programSelect.addEventListener('change', (e) => {
    handleProgramSelect(e.target.value);
  });
  
  // Allow Ctrl+Enter to run code
  codeEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runBtn.click();
    }
  });
  
  // Auto-resize textarea
  codeEditor.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });
});

