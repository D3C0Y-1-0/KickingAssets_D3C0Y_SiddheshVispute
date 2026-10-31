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
  it('keeps curated priorities scoped and preserves unavailable as null', async () => {
    const fetchMock = response({
      assets: [{ asset_id: 'unmapped', risk: { score: null, status: 'unavailable' } }],
    })
    const result = await api.intelligence(context)
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/intelligence?scenario_id=city-a&snapshot_id=snapshot-b',
    )
    expect(result.assets[0].risk.score).toBeNull()
  })
  it('posts explicit assessment context and surfaces stale evidence errors', async () => {
    const fetchMock = response(
      { error: { code: 'conflict', message: 'Vulnerability assessment is stale', details: [] } },
      409,
    )
    await expect(api.assessIntelligence(context)).rejects.toMatchObject({
      status: 409,
      message: 'Vulnerability assessment is stale',
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/intelligence/assess')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(context)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
  it('keeps vulnerability assessments scoped and preserves source-only CVSS separately from risk', async () => {
    const fetchMock = response({ id: 'run', assets: [], stale: false })
    await api.vulnerabilityAssessment(context)
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/vulnerabilities/assessment?scenario_id=city-a&snapshot_id=snapshot-b',
    )
    response({ references: [{ reference: { cvss: 9.8, epss: null, kev_listed: null } }] })
    const refs = await api.vulnerabilityReferences()
    expect(refs.references[0].reference.epss).toBeNull()
    expect(refs.references[0].reference.cvss).toBe(9.8)
  })
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
