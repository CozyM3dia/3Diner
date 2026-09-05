import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({context:vi.fn(),load:vi.fn()}));
vi.mock('@/lib/staff-context',()=>({getStaffContext:mocks.context,canOpenKitchenConsole:(r:string)=>['owner','kitchen'].includes(r),canOpenOwnerConsole:(r:string)=>['owner','manager'].includes(r)}));
vi.mock('@/lib/kitchen-query',()=>({ambilTiketDapur:mocks.load}));
import { GET } from '@/app/api/kitchen/route';
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({role:'owner',cafe_id:'own-cafe',is_active:true});mocks.load.mockResolvedValue([]);});
describe('kitchen feed authorization',()=>{
 it.each([null,'cashier','staff'])('rejects role %s',async role=>{mocks.context.mockResolvedValue({role,cafe_id:'own-cafe'});expect((await GET()).status).toBe(403);expect(mocks.load).not.toHaveBeenCalled();});
 it('rejects inactive staff',async()=>{mocks.context.mockResolvedValue({role:'kitchen',cafe_id:'own-cafe',is_active:false});expect((await GET()).status).toBe(403);});
 it('derives the cafe from the verified session and forbids caching',async()=>{const r=await GET();expect(r.status).toBe(200);expect(mocks.load).toHaveBeenCalledWith('own-cafe');expect(r.headers.get('Cache-Control')).toContain('no-store');});
 it('distinguishes query failure from an empty kitchen',async()=>{mocks.load.mockRejectedValue(new Error('database'));const r=await GET();expect(r.status).toBe(503);expect(await r.json()).not.toHaveProperty('tickets');});
 it('distinguishes auth service failure from forbidden',async()=>{mocks.context.mockResolvedValue({role:null,error:true});expect((await GET()).status).toBe(503);});
});
