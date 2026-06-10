import os
import glob

tests_dir = 'tests'
files = glob.glob(os.path.join(tests_dir, '*.spec.ts'))

for fpath in files:
    with open(fpath, 'r') as f:
        content = f.read()
    
    # Replace import { test, expect } from '@playwright/test' with '../fixtures'
    # Use simple replacement
    content = content.replace("from '@playwright/test'", "from '../fixtures'")
    
    # Remove all test.skip( to test(
    content = content.replace('test.skip(', 'test(')
    
    with open(fpath, 'w') as f:
        f.write(content)
        
print("Updated all spec files to use persistent fixtures and un-skipped tests.")
