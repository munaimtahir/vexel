import 'reflect-metadata';
import { AppModule } from './app.module';
import { EncountersModule } from './encounters/encounters.module';

describe('AppModule governance wiring', () => {
  it('does not register duplicate cash command routes', () => {
    const imports = (Reflect.getMetadata('imports', AppModule) ?? []) as any[];
    const importNames = imports.map((mod) => mod?.name).filter(Boolean);
    expect(imports).toContain(EncountersModule);
    expect(importNames).not.toContain('CashModule');
  });
});
