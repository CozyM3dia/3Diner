import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({range:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase-admin',()=>({supabaseAdmin:{from:()=>({select(){return this;},eq(...a:unknown[]){m.eq(...a);return this;},in(){return this;},order(){return this;},range:m.range})}}));
import { ambilTiketDapur } from '@/lib/kitchen-query';
beforeEach(()=>vi.clearAllMocks());
describe('kitchen full queue query',()=>{
 it('loads beyond the former 60-ticket cutoff and across database pages',async()=>{m.range.mockResolvedValueOnce({data:Array.from({length:200},(_,i)=>({id_order:String(i),items:[]}))}).mockResolvedValueOnce({data:[{id_order:'newest',items:null}]});const result=await ambilTiketDapur('cafe');expect(result).toHaveLength(201);expect(result[200].items).toEqual([]);expect(m.range).toHaveBeenNthCalledWith(2,200,399);expect(m.eq).toHaveBeenCalledWith('cafe_id','cafe');});
 it('never turns a database failure into a clean empty board',async()=>{m.range.mockResolvedValue({error:{message:'network'}});await expect(ambilTiketDapur('cafe')).rejects.toThrow('gagal');});
});
