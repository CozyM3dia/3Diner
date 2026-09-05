// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PapanDapur from "@/components/kitchen/PapanDapur";
import type { TiketDapur } from "@/lib/kitchen-model";

const mocks = vi.hoisted(() => ({ start: vi.fn(), ready: vi.fn(), finish: vi.fn(), bell: vi.fn() }));
vi.mock("@/lib/kitchen-actions", () => ({ mulaiMasak: mocks.start, tandaiSiap: mocks.ready, serahkanPesanan: mocks.finish }));
vi.mock("@/lib/kitchen-lonceng", () => ({ bunyikanLonceng: mocks.bell }));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
const ticket = (id: string, status: TiketDapur['status'] = 'received', createdAt = new Date().toISOString()): TiketDapur => ({ id_order:id, created_at:createdAt, status, payment_status:'paid', table_number:'Meja 7', notes:'Tanpa kacang', items:[{ id_menu:'m1',nama_menu:'Nasi Goreng',harga_menu:20000,qty:2 }] });
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.start.mockResolvedValue({}); mocks.ready.mockResolvedValue({}); mocks.finish.mockResolvedValue({});
  fetchMock.mockResolvedValue({ ok:true, json:async () => ({ tickets:[ticket('a')] }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const board = (initial=[ticket('a')]) => render(<PapanDapur awal={initial} cafeId="cafe-a" namaKafe="Senja" bingkai="konsol" />);

describe('kitchen end-to-end client contract', () => {
  it('defaults to today at the WIB boundary and keeps older tickets discoverable', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-05T17:30:00.000Z')); // 6 Sep 00:30 WIB
    const previous = ticket('previous', 'received', '2026-09-05T16:59:59.999Z'); // 5 Sep 23:59 WIB
    const today = ticket('today', 'received', '2026-09-05T17:00:00.000Z'); // 6 Sep 00:00 WIB
    fetchMock.mockResolvedValue({ ok:true, json:async () => ({ tickets:[previous,today] }) });

    board([previous,today]);

    expect(await screen.findByText('TIKET #TODAY')).toBeTruthy();
    expect(screen.queryByText('TIKET #PREVIOUS')).toBeNull();
    expect(screen.getByText('1 pesanan dari hari sebelumnya')).toBeTruthy();
    expect(screen.getByRole('button',{name:/Sebelumnya/}).textContent).toBe('Sebelumnya1');
    expect(screen.getByText('1 tiket · 2 porsi')).toBeTruthy();

    fireEvent.click(screen.getByRole('button',{name:/Lihat pesanan/}));

    expect(await screen.findByText('TIKET #PREVIOUS')).toBeTruthy();
    expect(screen.queryByText('TIKET #TODAY')).toBeNull();
    expect(screen.getByRole('button',{name:/Sebelumnya/}).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('1 tiket · 2 porsi')).toBeTruthy();

    fireEvent.click(screen.getByRole('button',{name:'Hari ini'}));
    expect(await screen.findByText('TIKET #TODAY')).toBeTruthy();
    expect(screen.queryByText('TIKET #PREVIOUS')).toBeNull();
  });

  it('restores preferences before persisting and labels a table only once', async () => {
    localStorage.setItem('dapur-preferensi', JSON.stringify({lonceng:true,rapat:'besar'}));
    board();
    await waitFor(() => expect(JSON.parse(localStorage.getItem('dapur-preferensi')!).lonceng).toBe(true));
    expect(screen.getByRole('heading',{name:'Meja 7'})).toBeTruthy();
    expect(screen.queryByText('Meja Meja 7')).toBeNull();
  });
  it('reconciles removed orders and new arrivals through the authorized endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({tickets:[ticket('new')]})});
    board();
    await waitFor(() => expect(screen.getByText(/TIKET #NEW/)).toBeTruthy());
    expect(screen.queryByText('TIKET #A')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/kitchen');
  });
  it('keeps the last snapshot and reports a failed refresh', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    board();
    await waitFor(() => expect(screen.getByText(/Koneksi terputus/)).toBeTruthy());
    expect(screen.getByRole('heading',{name:'Meja 7'})).toBeTruthy();
  });
  it('releases pending controls after a thrown action without advancing the ticket', async () => {
    mocks.start.mockRejectedValueOnce(new Error('network'));
    board();
    fireEvent.click(screen.getByRole('button',{name:'Mulai Masak'}));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('belum terkonfirmasi'));
    expect((screen.getByRole('button',{name:'Mulai Masak'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('prevents duplicate mutation and preserves another ticket while saving', async () => {
    let finish!: (value: object) => void;
    mocks.start.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    fetchMock.mockResolvedValue({ok:true,json:async()=>({tickets:[ticket('a'),ticket('b')]})});
    board([ticket('a'),ticket('b')]);
    const buttons=screen.getAllByRole('button',{name:'Mulai Masak'});
    fireEvent.click(buttons[0]); fireEvent.click(buttons[0]);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    await act(async()=>finish({error:'Sudah berubah'}));
    expect(screen.getByRole('alert').textContent).toContain('Sudah berubah');
  });
  it('can cancel the handoff delay before a terminal write', async () => {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({tickets:[ticket('a','ready')]})});
    board([ticket('a','ready')]);
    fireEvent.click(screen.getByRole('button',{name:'Serahkan'}));
    fireEvent.click(screen.getByRole('button',{name:'Batalkan serahkan'}));
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'Serahkan'})).toBeTruthy();
  });
  it('shows preparation notes and restores local line checkmarks', async () => {
    board();
    fireEvent.click(screen.getByRole('button',{name:'2 Nasi Goreng'}));
    expect(screen.getByRole('button',{name:'2 Nasi Goreng'}).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('dapur-plating:cafe-a')!).a).toHaveLength(1);
    expect(screen.getByText('Tanpa kacang')).toBeTruthy();
  });
});
