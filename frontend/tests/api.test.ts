import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../src/api/client'

afterEach(() => vi.unstubAllGlobals())
const context = { scenario_id: 'city-a', snapshot_id: 'snapshot-b' }
function response(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('snapshot-scoped API integration boundary', () => {
  it('preserves both IDs and cancellation for inventory reads', async () => {
    const fetchMock = response([])
    const controller = new AbortController()
    await api.assets(context, controller.signal)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/assets?scenario_id=city-a&snapshot_id=snapshot-b',
      expect.objectContaining({ signal: controller.signal }),
    )
  })
  it('requests cyber and operational data through independent typed modes', async () => {
    const fetchMock = response({ nodes: [], edges: [] })
    await api.graph('cyber', context)
    await api.graph('operational', context)
    expect(
      fetchMock.mock.calls.map((call) =>
        new URL(call[0] as string, 'http://localhost').searchParams.get('type'),
      ),
    ).toEqual(['cyber', 'operational'])
  })
  it('surfaces structured backend failures without returning a successful result', async () => {
    response(
      { error: { code: 'not_found', message: 'Snapshot not found in this scenario', details: [] } },
      404,
    )
    await expect(api.assets(context)).rejects.toMatchObject({
      status: 404,
      message: 'Snapshot not found in this scenario',
    })
  })
  it('handles a non-JSON proxy failure without obscuring the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Proxy unavailable', { status: 503 })),
    )
    await expect(api.scenarios()).rejects.toBeInstanceOf(ApiError)
    await expect(api.scenarios()).rejects.toThrow('API request failed (503)')
  })
  it('handles a JSON proxy error outside the application envelope', async () => {
    response({ detail: 'Upstream unavailable' }, 502)
    await expect(api.scenarios()).rejects.toThrow('API request failed (502)')
  })
  it('preserves an unavailable risk score as null', async () => {
    const payload = {
      asset: { id: 'PWR-001' },
      vulnerabilities: [],
      observations: [],
      risk: { status: 'unavailable', score: null },
    }
    response(payload)
    const detail = await api.asset('PWR-001', context)
    expect(detail.risk.score).toBeNull()
    expect(detail.risk.status).toBe('unavailable')
  })
  it('propagates cancellation instead of substituting fixtures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')))
    await expect(api.assets(context)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
