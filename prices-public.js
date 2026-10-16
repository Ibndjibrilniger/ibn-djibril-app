'use strict';
// Served dynamically at the existing script URL. No public layout or product list changes.
module.exports = function priceScript(prices) {
  return `(() => {
    let previous;
    function apply(prices) {
      const key=JSON.stringify(prices);
      if(key===previous)return;
      previous=key;
      window.IBN_PRIX_PRODUITS=prices;
      if(Array.isArray(window.IBN_CATALOGUE))window.IBN_CATALOGUE.forEach(product=>{
        const price=prices[product.id];if(!price)return;
        product.price=price.label;product.priceValue=price.value;
        product.currency='XOF';product.priceNegotiable=price.value===null;
      });
      window.dispatchEvent(new Event('ibn:prices-updated'));
    }
    apply(${JSON.stringify(prices).replace(/</g,'\\u003c')});
    let loading=false;
    async function refresh(){
      if(loading||document.hidden)return;loading=true;
      try{
        const response=await fetch('/api/prices',{cache:'no-store'});
        if(!response.ok)throw new Error('Prix indisponibles');
        const data=await response.json();apply(data.prices);
      }catch(_){window.dispatchEvent(new Event('ibn:prices-unavailable'));}
      finally{loading=false;}
    }
    setInterval(refresh,15000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('pageshow',refresh);
  })();`;
};
