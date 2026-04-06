import { jest } from '@jest/globals'
import { 
  getOrgRepos, 
  getSecurityAlertCount, 
  getCodeScanningAlertCount,
  getDependabotAlertCount,
  upsertLabel,
  getExistingLabels 
} from '../src/github'

const createMockOctokit = () => ({
  rest: {
    repos: { 
      listForOrg: jest.fn(), 
      listForUser: jest.fn() 
    },
    secretScanning: { 
      listAlertsForRepo: jest.fn() 
    },
    codeScanning: { 
      listAlertsForRepo: jest.fn() 
    },
    dependabot: { 
      listRepoAlerts: jest.fn() 
    },
    issues: { 
      getLabel: jest.fn(), 
      createLabel: jest.fn(), 
      updateLabel: jest.fn(), 
      listLabelsForRepo: jest.fn() 
    },
  },
  paginate: {
    iterator: jest.fn()
  },
  graphql: jest.fn(),
})

describe('getOrgRepos', () => {
  it('returns all repos when paginated across multiple pages', async () => {
    const mockOctokit = createMockOctokit()
    const repos = [
      { name: 'repo1', owner: { login: 'test-org' }, full_name: 'test-org/repo1', id: 1, archived: false, visibility: 'public' },
      { name: 'repo2', owner: { login: 'test-org' }, full_name: 'test-org/repo2', id: 2, archived: false, visibility: 'public' },
      { name: 'repo3', owner: { login: 'test-org' }, full_name: 'test-org/repo3', id: 3, archived: false, visibility: 'public' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: repos }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const result = await getOrgRepos(mockOctokit as any, 'test-org')

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      owner: 'test-org',
      name: 'repo1',
      full_name: 'test-org/repo1',
      id: 1,
      archived: false,
      visibility: 'public'
    })
  })

  it('filters out archived repos', async () => {
    const mockOctokit = createMockOctokit()
    const repos = [
      { name: 'repo1', owner: { login: 'test-org' }, full_name: 'test-org/repo1', id: 1, archived: false, visibility: 'public' },
      { name: 'archived-repo', owner: { login: 'test-org' }, full_name: 'test-org/archived-repo', id: 2, archived: true, visibility: 'public' },
      { name: 'repo2', owner: { login: 'test-org' }, full_name: 'test-org/repo2', id: 3, archived: false, visibility: 'public' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: repos }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const result = await getOrgRepos(mockOctokit as any, 'test-org')

    expect(result).toHaveLength(3)
    const nonArchivedRepos = result.filter(r => !r.archived)
    expect(nonArchivedRepos).toHaveLength(2)
  })

  it('returns empty array when org has no repos', async () => {
    const mockOctokit = createMockOctokit()
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: [] }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const result = await getOrgRepos(mockOctokit as any, 'empty-org')

    expect(result).toEqual([])
  })
})

describe('getSecurityAlertCount', () => {
  it('returns correct count when GHAS is enabled and alerts exist', async () => {
    const mockOctokit = createMockOctokit()
    const alerts = [
      { number: 1, state: 'open' },
      { number: 2, state: 'open' },
      { number: 3, state: 'open' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: alerts }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getSecurityAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(3)
  })

  it('returns 0 when 404 (GHAS not enabled)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Not Found')
    ;(error as any).status = 404
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getSecurityAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })

  it('returns 0 with warning when 403 (no permission)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Forbidden')
    ;(error as any).status = 403
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getSecurityAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })

  it('handles pagination correctly with 100 alerts across 2 pages', async () => {
    const mockOctokit = createMockOctokit()
    const page1 = Array.from({ length: 50 }, (_, i) => ({ 
      number: i + 1, 
      state: 'open' 
    }))
    const page2 = Array.from({ length: 50 }, (_, i) => ({ 
      number: i + 51, 
      state: 'open' 
    }))
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: page1 }
        yield { data: page2 }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getSecurityAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(100)
  })

  it('throws on unexpected errors', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Internal Server Error')
    ;(error as any).status = 500
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    await expect(
      getSecurityAlertCount(mockOctokit as any, 'owner', 'repo')
    ).rejects.toThrow('Internal Server Error')
  })
})

describe('getCodeScanningAlertCount', () => {
  it('returns correct count when code scanning is configured', async () => {
    const mockOctokit = createMockOctokit()
    const alerts = [
      { number: 1, state: 'open' },
      { number: 2, state: 'open' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: alerts }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getCodeScanningAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(2)
  })

  it('returns 0 when 404 (code scanning not configured)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Not Found')
    ;(error as any).status = 404
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getCodeScanningAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })

  it('returns 0 with warning when 403 (no permission)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Forbidden')
    ;(error as any).status = 403
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getCodeScanningAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })

  it('handles empty results', async () => {
    const mockOctokit = createMockOctokit()
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: [] }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getCodeScanningAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })
})

describe('getDependabotAlertCount', () => {
  it('returns correct count', async () => {
    const mockOctokit = createMockOctokit()
    const alerts = [
      { number: 1, state: 'open' },
      { number: 2, state: 'open' },
      { number: 3, state: 'open' },
      { number: 4, state: 'open' },
      { number: 5, state: 'open' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: alerts }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getDependabotAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(5)
  })

  it('returns 0 when 404 (Dependabot not enabled)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Not Found')
    ;(error as any).status = 404
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getDependabotAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })

  it('handles large counts (enterprise with many vulnerable deps)', async () => {
    const mockOctokit = createMockOctokit()
    const page1 = Array.from({ length: 250 }, (_, i) => ({ 
      number: i + 1, 
      state: 'open' 
    }))
    const page2 = Array.from({ length: 250 }, (_, i) => ({ 
      number: i + 251, 
      state: 'open' 
    }))
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: page1 }
        yield { data: page2 }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getDependabotAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(500)
  })

  it('returns 0 with warning when 403 (no permission)', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Forbidden')
    ;(error as any).status = 403
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const count = await getDependabotAlertCount(mockOctokit as any, 'owner', 'repo')

    expect(count).toBe(0)
  })
})

describe('upsertLabel', () => {
  it('creates label when it does not exist', async () => {
    const mockOctokit = createMockOctokit()
    mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 })
    mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: { name: 'S-5' } })

    await upsertLabel(mockOctokit as any, 'owner', 'repo', 'S-5', 'ff0000', 'Security alerts')

    expect(mockOctokit.rest.issues.getLabel).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      name: 'S-5'
    })
    expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      name: 'S-5',
      color: 'ff0000',
      description: 'Security alerts'
    })
  })

  it('updates label when it already exists', async () => {
    const mockOctokit = createMockOctokit()
    mockOctokit.rest.issues.getLabel.mockResolvedValue({
      data: { name: 'S-5' }
    })
    mockOctokit.rest.issues.updateLabel.mockResolvedValue({
      data: { name: 'S-5' }
    })

    await upsertLabel(mockOctokit as any, 'owner', 'repo', 'S-5', 'ff0000', 'Security alerts')

    expect(mockOctokit.rest.issues.updateLabel).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      name: 'S-5',
      color: 'ff0000',
      description: 'Security alerts'
    })
  })

  it('handles unexpected errors', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Internal Server Error')
    ;(error as any).status = 500
    mockOctokit.rest.issues.getLabel.mockRejectedValue(error)

    await expect(
      upsertLabel(mockOctokit as any, 'owner', 'repo', 'S-5', 'ff0000', 'Security alerts')
    ).rejects.toThrow('Internal Server Error')
  })
})

describe('getExistingLabels', () => {
  it('returns all labels for a repo', async () => {
    const mockOctokit = createMockOctokit()
    const labels = [
      { name: 'bug' },
      { name: 'S-5' },
      { name: 'enhancement' }
    ]
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield { data: labels }
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const result = await getExistingLabels(mockOctokit as any, 'owner', 'repo')

    expect(result).toEqual(['bug', 'S-5', 'enhancement'])
  })

  it('returns empty array on error', async () => {
    const mockOctokit = createMockOctokit()
    const error = new Error('Not Found')
    
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        throw error
      }
    }
    mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

    const result = await getExistingLabels(mockOctokit as any, 'owner', 'repo')

    expect(result).toEqual([])
  })
})
