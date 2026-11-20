// Evita que textos de cadastros sejam interpretados como fórmulas em planilhas.
function celulaCsv(value){
 let s=value==null?'':String(value);
 if(typeof value!=='number'&&/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
module.exports={celulaCsv};
