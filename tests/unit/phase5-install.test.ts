import {expect,it} from 'vitest';
import {compareInstalledLock} from '../../scripts/verify-phase5-install.mjs';
const before={lockfileVersion:3,packages:{'':{dependencies:{fictional:'1.0.0'}},'node_modules/fictional':{version:'1.0.0',integrity:'fictional'}}};
const after=()=>{const copy=structuredClone(before);return{...copy,packages:{...copy.packages,'':{dependencies:{fictional:'1.0.0',yaml:'2.9.1'}},'node_modules/yaml':{version:'2.9.1'}}};};
it('accepts only the admitted additional package while retaining original locks',()=>{expect(compareInstalledLock(before,after(),'yaml')).toEqual([]);});
it('rejects an upgrade or missing original locked dependency',()=>{
  const upgrade=after();upgrade.packages['node_modules/fictional'].version='2.0.0';expect(compareInstalledLock(before,upgrade,'yaml').length).toBeGreaterThan(0);
});
it('rejects an unreviewed new transitive or changed original root declaration',()=>{
  const added=after();Object.assign(added.packages,{'node_modules/unreviewed':{version:'1.0.0'}});expect(compareInstalledLock(before,added,'yaml').length).toBeGreaterThan(0);
  const changed=after();changed.packages[''].dependencies.fictional='2.0.0';expect(compareInstalledLock(before,changed,'yaml').length).toBeGreaterThan(0);
});
