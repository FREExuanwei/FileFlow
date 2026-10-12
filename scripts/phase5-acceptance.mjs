export function acceptanceErrors(e){const errors=[];
  if(e.originalUnit.passed!==103||e.originalUnit.total!==103)errors.push('original-unit');
  if(e.unit.passed!==e.unit.total||e.unit.pending||!e.unit.total)errors.push('unit');
  if(e.browser.passed!==90||e.browser.total!==90||e.browser.phase3.errors.length)errors.push('original-browser');
  for(const engine of ['edge','chrome'])for(const mode of ['development','production']){const matches=e.newBrowsers.filter(b=>b.engine===engine&&b.mode===mode),b=matches[0];if(matches.length!==1||!b.total||b.passed!==b.total||b.skipped||b.unexpected||b.flaky)errors.push(`${engine}-${mode}`);}
  for(const name of ['lint','typecheck','build','secrets','audit','dependency-review','bundle'])if(!e.commands[name]?.executed||e.commands[name].exitCode!==0)errors.push(name);
  if(e.unresolvedHigh.length)errors.push('unresolved-high');if(e.baselineErrors.length)errors.push('sealed-baseline');if(e.frozenUnexpected.length)errors.push('frozen');return errors;
}
