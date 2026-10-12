export function evaluateDependency(record,advisories){
  const reasons=[],candidate=record?.name==='yaml'?{version:'2.9.1',spec:'2.9.1',source:'https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz',license:'ISC'}:record?.name==='xlsx'?{version:'0.20.3',spec:'file:vendor/xlsx-0.20.3.tgz',source:'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz',license:'Apache-2.0'}:undefined;
  if(!candidate)return{decision:'BLOCKED',reasons:['Unsupported candidate']};
  for(const [field,expected] of Object.entries({version:candidate.version,dependencySpec:candidate.spec,source:candidate.source,license:candidate.license}))if(record[field]!==expected)reasons.push(`Candidate ${field} mismatch`);
  if(!/^[a-f0-9]{64}$/.test(record.archiveSha256??'')||!Number.isSafeInteger(record.bytes)||record.bytes<=0||!record.integrityVerified)reasons.push('Missing verified artifact identity');
  if(record.name==='yaml'&&record.archiveSha256!=='4ef6c54cf559b8a207b7b518378230805a1c84af239b14960e8c67c7d59de5d3')reasons.push('Archive differs from reviewed yaml acquisition');
  if(record.name==='xlsx'&&record.archiveSha256!=='8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8')reasons.push('Archive differs from first official SheetJS acquisition');
  const members=record.memberHashes;
  if(!members||Object.keys(members).length<2||!Object.hasOwn(members,'package/package.json')||Object.values(members).some(value=>!/^[a-f0-9]{64}$/.test(value)))reasons.push('Missing complete member hashes');
  if(!Array.isArray(record.licenses)||!record.licenses.length||record.licenses.some(path=>!Object.hasOwn(members??{},path)))reasons.push('Missing license inventory');
  if(!record.scripts||Object.keys(record.scripts).some(name=>/^(?:preinstall|install|postinstall|prepare)$/.test(name)))reasons.push('Install lifecycle script');
  const relations=record.relationships;
  if(!relations||!Array.isArray(relations.direct)||!Array.isArray(relations.transitive)||!Array.isArray(relations.embedded)||relations.direct.length||relations.transitive.length||relations.embedded.some(item=>!item.name||!item.license||!item.review))reasons.push('Unreviewed dependency inventory');
  if(!Array.isArray(record.importGraph)||!record.importGraph.length||!Array.isArray(record.binaries)||record.binaries.length)reasons.push('Unreviewed imports or native binary');
  if(!record.reviewComplete||!record.runtimeNetwork?.reviewed||record.runtimeNetwork.externalFallback)reasons.push('Incomplete source/network review');
  if(!Array.isArray(advisories))reasons.push('Missing advisory review');else for(const advisory of advisories){
    if(!advisory.id||!advisory.severity||advisory.actualVendoredVersion!==candidate.version||!['Applicable','Not applicable with evidence','Unresolved'].includes(advisory.disposition))reasons.push('Incomplete advisory disposition');
    if(advisory.disposition==='Not applicable with evidence'&&(!advisory.evidence?.length||advisory.evidence.some(e=>typeof e!=='string'||!e.trim())))reasons.push(`Missing fix evidence: ${advisory.id}`);
    if(/HIGH|CRITICAL/i.test(advisory.severity)&&advisory.disposition!=='Not applicable with evidence')reasons.push(`Unresolved/applicable severe advisory: ${advisory.id}`);
  }
  if(record.name==='xlsx'){
    for(const id of ['GHSA-4r6h-8v6p-xvw6','GHSA-5pgg-2g8v-p4x9']){
      const alert=advisories?.find(a=>a.id===id),proof=record.fixVerifications?.find(p=>p.id===id);
      if(!alert?.scannerClaimedRange||!alert.officialSheetjsRange||!alert.reachableApi||!alert.source||!alert.checkedAt||!alert.rawResponse)reasons.push(`Missing actual advisory provenance: ${id}`);
      if(!proof||record.memberHashes?.[proof.sourcePath]!==proof.sourceSha256||!proof.fixedSourceEvidence?.length||!proof.regression?.command||proof.regression.exitCode!==0||!proof.regression.reportPath||!/^[a-f0-9]{64}$/.test(proof.regression.reportSha256??''))reasons.push(`Missing bound fix/regression proof: ${id}`);
    }
    if(!record.relationships?.embedded?.some(item=>item.name==='CFB')||!record.relationships?.embedded?.some(item=>item.name==='CRC32')||!record.relationships?.embedded?.some(item=>item.name==='SSF'))reasons.push('Incomplete SheetJS embedded inventory');
  }
  return{decision:reasons.length?'BLOCKED':'PASS',reasons};
}
