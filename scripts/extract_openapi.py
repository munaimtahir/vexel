import yaml
import json

def extract_openapi_ops(file_path):
    with open(file_path, 'r') as f:
        spec = yaml.safe_load(f)
    
    ops = []
    for path, methods in spec.get('paths', {}).items():
        for method, details in methods.items():
            if method.lower() not in ['get', 'post', 'put', 'patch', 'delete']:
                continue
            ops.append({
                'path': path,
                'method': method.upper(),
                'operationId': details.get('operationId'),
                'summary': details.get('summary'),
                'tags': details.get('tags', [])
            })
    return ops

if __name__ == "__main__":
    ops = extract_openapi_ops('packages/contracts/openapi.yaml')
    with open('openapi_ops.json', 'w') as f:
        json.dump(ops, f, indent=2)
    print(f"Extracted {len(ops)} operations.")
