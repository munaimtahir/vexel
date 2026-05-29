import os
import re
import json

def scan_frontend(directory, app_name):
    # Matches api.METHOD('path', ...) or (api.METHOD as any)('path', ...)
    pattern = re.compile(r'api\.(GET|POST|PUT|PATCH|DELETE)(?:\s+as\s+any)?\s*\(\s*[`\'"](.*?)[`\'"]', re.IGNORECASE)
    
    results = []
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.ts', '.tsx')):
                continue
            
            file_path = os.path.join(root, file)
            relative_path = os.path.relpath(file_path, directory)
            
            with open(file_path, 'r', errors='ignore') as f:
                content = f.read()
                matches = pattern.findall(content)
                for method, path in matches:
                    results.append({
                        'app': app_name,
                        'file': relative_path,
                        'method': method.upper(),
                        'path': path
                    })
    return results

if __name__ == "__main__":
    admin_calls = scan_frontend('apps/admin/src', 'admin')
    operator_calls = scan_frontend('apps/operator/src', 'operator')
    
    all_calls = admin_calls + operator_calls
    with open('frontend_calls.json', 'w') as f:
        json.dump(all_calls, f, indent=2)
    print(f"Extracted {len(all_calls)} frontend calls.")
