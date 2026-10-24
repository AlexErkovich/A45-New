export function paginateCaption(text,fits){
 const chars=Array.from(text||''),pages=[];let start=0;
 while(start<chars.length){let low=1,high=chars.length-start,best=1;
  while(low<=high){const mid=Math.floor((low+high)/2);if(fits(chars.slice(start,start+mid).join(''))){best=mid;low=mid+1}else high=mid-1}
  let end=start+best;
  if(end<chars.length){for(let i=end;i>start+best*.55;i--)if(/\s/u.test(chars[i-1])){end=i;break}}
  pages.push(chars.slice(start,end).join(''));start=end;
 }
 return pages.length?pages:[''];
}
