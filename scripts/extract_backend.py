import os
import re
import json

def scan_backend_controllers(directory):
    # Matches @Controller('path') or @Controller(['p1', 'p2'])
    ctrl_pattern = re.compile(r'@Controller\((?:\[(.*?)\]|[\'"](.*?)[\'"])\)', re.DOTALL)
    # Matches @Get('path'), @Post('path'), etc.
    method_pattern = re.compile(r'@(Get|Post|Put|Patch|Delete)\((?:[\'"](.*?)[\'"])?\)', re.DOTALL)
    # Matches @RequirePermissions(Permission.ACTION)
    perm_pattern = re.compile(r'@RequirePermissions\((.*?)\)')
    # Matches functionName(...) {
    func_pattern = re.compile(r'async?\s+(\w+)\s*\(', re.DOTALL)

    results = []
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith('.controller.ts'):
                continue
            
            file_path = os.path.join(root, file)
            with open(file_path, 'r', errors='ignore') as f:
                content = f.read()
                
                ctrl_matches = ctrl_pattern.search(content)
                if not ctrl_matches:
                    continue
                
                base_paths = []
                if ctrl_matches.group(1): # Array
                    base_paths = [p.strip().strip('\'"') for p in ctrl_matches.group(1).split(',')]
                else: # Single string
                    base_paths = [ctrl_matches.group(2)]
                
                # Split content by methods to associate permissions
                sections = re.split(r'@(?:Get|Post|Put|Patch|Delete)', content)
                # First section is before any method
                
                # This is a bit simplified. A better way is to iterate through matches.
                for match in re.finditer(r'@(Get|Post|Put|Patch|Delete)\((?:[\'"](.*?)[\'"])?\)', content):
                    method = match.group(1).upper()
                    sub_path = match.group(2) or ""
                    
                    # Search backwards for permission
                    prefix = content[:match.start()]
                    perm_match = perm_pattern.findall(prefix)[-1] if perm_pattern.search(prefix) else ""
                    
                    # Search forwards for function name
                    suffix = content[match.end():]
                    func_match = func_pattern.search(suffix)
                    func_name = func_match.group(1) if func_match else ""
                    
                    for base in base_paths:
                        full_path = f"/{base}/{sub_path}".replace('//', '/').rstrip('/')
                        if full_path == "": full_path = "/"
                        # Normalize path params for mapping
                        norm_path = re.sub(r':(\w+)', r'{\1}', full_path)
                        
                        results.append({
                            'controller': file,
                            'method': method,
                            'path': norm_path,
                            'permission': perm_match.replace('Permission.', ''),
                            'function': func_name
                        })
    return results

if __name__ == "__main__":
    backend_map = scan_backend_controllers('apps/api/src')
    with open('backend_map.json', 'w') as f:
        json.dump(backend_map, f, indent=2)
    print(f"Extracted {len(backend_map)} backend endpoints.")
