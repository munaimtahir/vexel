import { Injectable } from '@nestjs/common';

const FLAGS = [
  { key: 'module.lims', enabled: false, description: 'LIMS module' },
  { key: 'module.opd', enabled: false, description: 'OPD module' },
  { key: 'lims.auto_verify', enabled: false, description: 'Auto-verify results' },
];

@Injectable()
export class FeatureFlagsService {
  list() { return FLAGS; }
  set(key: string, enabled: boolean) {
    const flag = FLAGS.find(f => f.key === key);
    if (flag) flag.enabled = enabled;
    return flag ?? { key, enabled, description: '' };
  }
}
