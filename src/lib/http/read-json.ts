import { HttpError } from './api';

export async function readJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415,'Envie os dados em JSON. Arquivos não são aceitos.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400,'Corpo JSON obrigatório.');
  const chunks: Uint8Array[]=[];
  let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>32768){await reader.cancel();throw new HttpError(413,'Requisição muito grande. Limite de 32 KiB.');}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
    catch { throw new HttpError(400,'JSON inválido.'); }
  } finally { reader.releaseLock(); }
}
