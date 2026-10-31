import test from 'node:test';
import assert from 'node:assert/strict';
import {iconForRule,catalogIconMap,fallbackRuleIcon,needsDarkInk} from '../site/rule-icons.mjs';

test('brand services use their own or parent brand icons',()=>{
 for(const [name,file]of [['Google','google'],['YouTubeMusic','youtubemusic'],['AppleIntelligence','apple'],['GoogleRegistry','google']]){
  const icon=iconForRule({name});assert.equal(icon.kind,'brand');assert.equal(icon.url,'/brand-icons/'+file+'.svg');
 }
});
test('catalog matches names exactly and only accepts local image paths',()=>{
 const map=catalogIconMap({icons:[{name:'ExampleService.png',url:'/icons/assets/example-123.png'},{name:'bad',url:'https://other.example/track.svg'},{name:'bad2',url:'/icons/assets/../track.svg'}]});
 assert.equal(iconForRule({name:'ExampleService'},map).url,'/icons/assets/example-123.png');
 assert.equal(iconForRule({name:'ExampleServiceOther'},map).kind,'fallback');
 assert.equal(map.has('bad'),false);assert.equal(map.has('bad2'),false);
});
test('categories cover composite rules and future unknown rules always have a safe icon',()=>{
 for(const [name,category]of [['AdvertisingLite','security'],['GlobalGame','game'],['GlobalAI','ai'],['ChinaIPs','network'],['17173','game']])assert.equal(iconForRule({name}).url,'/rule-icons/'+category+'.svg');
 for(const name of ['UnrecognizedFutureRule','../../private','<script>alert(1)</script>','__proto__',''])assert.equal(iconForRule({name}).url,'/rule-icons/rules.svg');
 assert.ok(fallbackRuleIcon.startsWith('data:image/svg+xml,'));
});
test('white transparent artwork needs dark ink while opaque backgrounds and dark logos remain unchanged',()=>{
 assert.equal(needsDarkInk([255,255,255,255,0,0,0,0]),true);
 assert.equal(needsDarkInk([255,255,255,255,255,255,255,255]),false);
 assert.equal(needsDarkInk([0,0,0,255,0,0,0,0]),false);
 assert.equal(needsDarkInk([220,30,40,255,0,0,0,0]),false);
 assert.equal(needsDarkInk([0,0,0,0]),false);
});
