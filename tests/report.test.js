import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, percentage } from '../public/report.js';
const row=(month,issued,waste,extra={})=>({item:'PMENVTEST',description:'Envelope',flvGroup:'ENV',site:'BTI',month,issued,waste,transactions:1,...extra});
test('cumulative uses running totals, including months with no waste',()=>{
  const r=buildReport([row(1,148000,0),row(2,75140,24558),row(3,170920,19480)],{year:2026,from:1,to:3});
  assert.equal(r.items[0].months[0].percent,0);
  assert.ok(Math.abs(r.items[0].months[1].percent-32.683)<.001);
  assert.equal(r.items[0].months[1].cumulative,24558/223140*100);
  assert.equal(r.totals.percent,44038/394060*100);
});
test('zero/negative denominator is undefined, missing months carry cumulative forward',()=>{
  assert.equal(percentage(10,0),null); assert.equal(percentage(10,-10),null);
  const r=buildReport([row(1,100,10),row(3,0,5)],{year:2026,from:1,to:3});
  assert.equal(r.months[1].percent,null);assert.equal(r.months[1].cumulative,10);assert.equal(r.months[2].cumulative,15);
});
test('selected range resets running totals and search, category, site filters apply',()=>{
 const rows=[row(1,100,90),row(2,100,20),row(2,100,80,{site:'Default'}),row(2,200,40,{item:'PMBOXTEST',description:'Box'})];
 const r=buildReport(rows,{year:2026,from:2,to:3,search:'envelope',category:'ENV',site:'BTI'});
 assert.equal(r.items.length,1);assert.equal(r.totals.percent,20);assert.equal(r.months[0].cumulative,20);
});
test('weighted totals, signed offsets, and sites aggregate without losing rows',()=>{
 const r=buildReport([row(1,100,10),row(1,-20,-2,{site:'Default'}),row(1,900,9,{item:'PMBOXTEST'})],{year:2026,from:1,to:1});
 assert.equal(r.totals.issued,980);assert.equal(r.totals.waste,17);assert.equal(r.totals.percent,17/980*100);
});
test('categories and no matching records',()=>{
 assert.equal(buildReport([row(1,100,10,{flvGroup:null})],{year:2026}).items[0].category,'Unclassified');
 const r=buildReport([row(1,100,10,{flvGroup:'Tea'})],{year:2026,category:'Tea'});assert.equal(r.items[0].category,'Tea');
 assert.equal(buildReport([],{year:2026}).totals.percent,null);
});

