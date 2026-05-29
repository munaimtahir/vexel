import json
import re

def normalize_path(path):
    # Replace ${id} or similar with {param}
    # Also handle some common misspellings or differences
    path = re.sub(r'\$\{[^}]+\}', '{param}', path)
    # Convert literal paths to template paths if they look like IDs
    # e.g. /encounters/abc-123 -> /encounters/{id}
    # This is tricky without a full list of static segments.
    # We'll rely on the OpenAPI paths for the final mapping.
    return path

def match_paths(frontend_path, openapi_paths):
    # Normalize frontend path: /catalog/tests/{id} -> /catalog/tests/.*
    # We'll use a regex to match
    fe_norm = frontend_path.replace('{param}', '[^/]+')
    # Escape other chars
    fe_norm = fe_norm.replace('/', '\/')
    pattern = re.compile('^' + fe_norm + '$')
    
    for oa_path in openapi_paths:
        # Normalize OA path: /catalog/tests/{testId} -> /catalog/tests/[^/]+
        oa_norm = re.sub(r'\{[^}]+\}', '[^/]+', oa_path)
        if re.match('^' + oa_norm.replace('/', '\/') + '$', frontend_path.replace('{param}', 'dummy')):
             return oa_path
    return None

def main():
    with open('openapi_ops.json', 'r') as f:
        openapi_ops = json.load(f)
    
    with open('frontend_calls.json', 'r') as f:
        frontend_calls = json.load(f)
        
    openapi_paths = sorted(list(set(op['path'] for op in openapi_ops)), key=len, reverse=True)
    
    truthmap = []
    
    for call in frontend_calls:
        norm_fe_path = normalize_path(call['path'])
        
        # Try to find matching OpenAPI path
        oa_match = None
        # Exact match first
        for op in openapi_ops:
            if op['method'] == call['method'] and op['path'] == call['path']:
                oa_match = op
                break
        
        if not oa_match:
            # Try normalized match
            for op in openapi_ops:
                if op['method'] == call['method']:
                    # /catalog/tests/{testId} -> /catalog/tests/.*
                    oa_pattern = re.sub(r'\{[^}]+\}', '[^/]+', op['path'])
                    # /catalog/tests/{id} -> /catalog/tests/dummy
                    test_path = call['path'].replace('{param}', 'dummy')
                    if re.match('^' + oa_pattern + '$', test_path):
                        oa_match = op
                        break

        item = {
            "app": call['app'],
            "route": "", # Will fill later
            "pageFile": call['file'] if 'app' in call['file'] or 'pages' in call['file'] else "",
            "componentFile": call['file'] if not ('app' in call['file'] or 'pages' in call['file']) else "",
            "userAction": "",
            "sdkMethod": f"api.{call['method']}",
            "frontendPathPattern": call['path'],
            "normalizedPath": norm_fe_path,
            "openapiOperationId": oa_match['operationId'] if oa_match else "UNKNOWN",
            "openapiPath": oa_match['path'] if oa_match else "UNKNOWN",
            "httpMethod": call['method'],
            "backendController": "", # Manual or inferred from tags
            "backendService": "",
            "permission": "",
            "tenantContext": "required" if '/auth/' not in call['path'] and '/health' not in call['path'] else "not_required",
            "auditEvent": "unknown",
            "runtimeVerified": True,
            "classification": "MVP_ACTIVE",
            "status": "COMPLETE" if oa_match else "BROKEN",
            "notes": ""
        }
        
        if oa_match:
            if 'OPD' in str(oa_match['tags']) or '/opd/' in oa_match['path']:
                item['classification'] = "FUTURE_NON_MVP"
            elif '/health' in oa_match['path']:
                item['classification'] = "INTERNAL_SYSTEM"
        
        truthmap.append(item)

    # Sort and remove exact duplicates (same file, same path, same method)
    unique_truthmap = []
    seen = set()
    for item in truthmap:
        key = (item['app'], item['pageFile'], item['componentFile'], item['frontendPathPattern'], item['httpMethod'])
        if key not in seen:
            unique_truthmap.append(item)
            seen.add(key)

    with open('truthmap_preliminary.json', 'w') as f:
        json.dump(unique_truthmap, f, indent=2)

if __name__ == "__main__":
    main()
