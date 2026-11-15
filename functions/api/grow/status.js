import {answer,environment} from './_shared.js';
// Public capability discovery only. Never expose Grow identifiers or keys.
export function onRequestGet({env}){
 const base=environment(env);
 return answer(200,{enabled:!!base,environment:base?env.GROW_MODE:null});
}
