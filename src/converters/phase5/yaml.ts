import {parseDocument,stringify,isAlias,isMap,isSeq,isScalar,isNode,type Node,type Document} from 'yaml';
import type {P5Notice,P5Data} from '../../core/phase5/types';
import {P5Error} from '../../core/phase5/errors';
import {P5_LIMITS as limits,assertLimit} from '../../core/phase5/limits';
import {parseSafeJson} from '../../core/phase5/safe-json';
import {stringifyBounded} from '../../core/phase5/serialize';
import {utf8Bytes} from '../../core/phase5/table';
const forbidden=new Set(['__proto__','constructor','prototype','<<']);
const reject=():never=>{throw new P5Error('structure');};
const over=(value:number,max:number)=>{if(value>max)throw new P5Error('size');};
function primitive(value:unknown):string|number|boolean|null{
  if(typeof value==='bigint'){if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER))throw new P5Error('precision');return Number(value);}
  if(typeof value==='number'){if(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value))throw new P5Error('precision');return value;}
  if(typeof value==='string'){over(value.length,limits.scalarUnits);return value;}
  if(value===null||typeof value==='boolean')return value;return reject();
}
function safeData(value:unknown):P5Data{
  if(Array.isArray(value))return value.map(safeData);
  if(value&&typeof value==='object'){
    if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return reject();
    const safe:Record<string,P5Data>=Object.create(null);
    for(const [key,item] of Object.entries(value)){if(forbidden.has(key))return reject();safe[key]=safeData(item);}return safe;
  }
  return primitive(value);
}
/** Validate syntax and the reference graph before allowing library materialization. */
function checkAst(doc:Document):void{
  let nodes=0,anchors=0,aliases=0;
  const children=(node:Node):Node[]=>{
    if(isMap(node)){const result:Node[]=[];for(const pair of node.items){
      if(!isScalar(pair.key)||typeof pair.key.value!=='string'||forbidden.has(pair.key.value))return reject();
      result.push(pair.key);if(isNode(pair.value))result.push(pair.value);
    }return result;}
    if(isSeq(node))return node.items.filter(isNode);return[];
  };
  const syntax=(node:Node,depth:number)=>{
    over(++nodes,limits.nodes);if(node.tag)return reject();
    if(isAlias(node)){over(++aliases,limits.yamlAliasNodes);return;}
    if('anchor' in node&&node.anchor)over(++anchors,limits.yamlAnchors);
    if(isScalar(node))primitive(node.value);
    if(isMap(node)||isSeq(node)){over(depth+1,limits.depth);for(const child of children(node))syntax(child,depth+1);}
  };
  const root=doc.contents;if(!isNode(root))return;syntax(root,0);
  const active=new Set<Node>(),memo=new Map<Node,{size:number;height:number}>();
  const predict=(node:Node):{size:number;height:number}=>{
    if(active.has(node))return reject();const known=memo.get(node);if(known)return known;active.add(node);
    let size=1,height=0;
    if(isAlias(node)){const target=node.resolve(doc);if(!target)return reject();const result=predict(target);size=result.size;height=result.height;}
    else if(isMap(node)||isSeq(node)){height=1;for(const child of children(node)){const result=predict(child);size+=result.size;height=Math.max(height,1+result.height);over(size,limits.nodes);over(height,limits.depth);}}
    active.delete(node);const result={size,height};memo.set(node,result);return result;
  };
  predict(root);
  // Mirror v2's independent weighted maxAliasCount check without creating JS values.
  const counts=new Map<Node,{count:number;weight:number}>();
  const weight=(node:Node):number=>{
    if(isAlias(node)){const target=node.resolve(doc),entry=target&&counts.get(target);return entry?entry.count*entry.weight:0;}
    const parts=children(node);return parts.length?parts.reduce((max,child)=>Math.max(max,weight(child)),0):isScalar(node)?1:0;
  };
  const visit=(node:Node):void=>{
    if(isAlias(node)){const target=node.resolve(doc),entry=target&&counts.get(target);if(!entry)return reject();entry.count++;entry.weight||=weight(target);over(entry.count*entry.weight,limits.yamlAliasCount);return;}
    if('anchor' in node&&node.anchor)counts.set(node,{count:1,weight:0});for(const child of children(node))visit(child);
  };
  visit(root);
}
export function convertSafeYaml(routeId:'yaml-to-json'|'json-to-yaml',text:string):{text:string;notices:P5Notice[]}{
  assertLimit('structuredSource',utf8Bytes(text));text=text.replace(/^\uFEFF/,'');
  let output:string;
  if(routeId==='yaml-to-json'){
    const doc=parseDocument(text,{version:'1.2',schema:'core',customTags:[],resolveKnownTags:false,merge:false,strict:true,uniqueKeys:true,intAsBigInt:true,prettyErrors:false,logLevel:'error'});
    if(doc.errors.length||doc.warnings.length||doc.directives?.yaml.version!=='1.2')return reject();
    checkAst(doc);let value:unknown;try{value=doc.toJS({maxAliasCount:limits.yamlAliasCount});}catch{return reject();}
    output=stringifyBounded(safeData(value),2,limits.structuredOutput);
  }else if(routeId==='json-to-yaml'){
    const data=safeData(parseSafeJson(text,limits).value);
    // Bound the serializer's input before it creates its own node graph.
    stringifyBounded(data,2,limits.structuredOutput/2);
    output=stringify(data,{version:'1.2',schema:'core',customTags:[],resolveKnownTags:false,merge:false,aliasDuplicateObjects:false,indent:2,lineWidth:0});
  }else throw new P5Error('type');
  if(utf8Bytes(output)>limits.structuredOutput)throw new P5Error('output');
  return{text:output,notices:[{code:'yaml-layout-loss'}]};
}
