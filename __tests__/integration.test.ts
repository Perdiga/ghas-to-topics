import { jest } from '@jest/globals'
import { processRepoTopics } from '../src/topics'
import { Repository, AlertCounts } from '../src/types'

const createMockOctokit = () => ({
  rest: {
    repos: {
      getAllTopics: jest.fn(),
      replaceAllTopics: jest.fn()
    }
  }
})

describe('Integration Tests - End-to-End Flow', () => {
  describe('Scenario 1: Happy path - new topics on repo with alerts', () => {
    it('sets topics for repo with 5 security, 2 code, 10 Dependabot alerts', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 5, codeScanning: 2, dependabot: 10 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({ data: { names: [] } })
      ;(mockOctokit.rest.repos.replaceAllTopics as any).mockResolvedValue({ data: {} })

      const topicsChanged = await processRepoTopics(mockOctokit as any, repo, counts, false)

      expect(topicsChanged).toBe(1)
      expect(mockOctokit.rest.repos.replaceAllTopics).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-org',
          repo: 'test-repo',
          names: expect.arrayContaining(['ghas-secret-5', 'ghas-code-2', 'ghas-dependabot-10'])
        })
      )
    })
  })

  describe('Scenario 2: Idempotency - re-running with same counts', () => {
    it('does not call replaceAllTopics when topics already match', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 5, codeScanning: 2, dependabot: 10 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({
        data: { names: ['ghas-secret-5', 'ghas-code-2', 'ghas-dependabot-10'] }
      })

      const topicsChanged = await processRepoTopics(mockOctokit as any, repo, counts, false)

      expect(topicsChanged).toBe(0)
      expect(mockOctokit.rest.repos.replaceAllTopics).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 3: Count changed - topic needs update', () => {
    it('replaces ghas-secret-3 with ghas-secret-7', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 7, codeScanning: 2, dependabot: 10 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({
        data: { names: ['ghas-secret-3', 'ghas-code-2', 'ghas-dependabot-10'] }
      })
      ;(mockOctokit.rest.repos.replaceAllTopics as any).mockResolvedValue({ data: {} })

      const topicsChanged = await processRepoTopics(mockOctokit as any, repo, counts, false)

      expect(topicsChanged).toBe(1)
      const call = (mockOctokit.rest.repos.replaceAllTopics as any).mock.calls[0][0]
      expect(call.names).toContain('ghas-secret-7')
      expect(call.names).not.toContain('ghas-secret-3')
    })
  })

  describe('Scenario 4: Dry-run mode', () => {
    it('logs actions but makes no API calls', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 5, codeScanning: 2, dependabot: 10 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({ data: { names: [] } })

      const topicsChanged = await processRepoTopics(mockOctokit as any, repo, counts, true)

      expect(topicsChanged).toBe(1)
      expect(mockOctokit.rest.repos.replaceAllTopics).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 5: Zero alert counts', () => {
    it('does not set topic when count is 0 and no existing GHAS topics', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 0, codeScanning: 1, dependabot: 0 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({ data: { names: [] } })
      ;(mockOctokit.rest.repos.replaceAllTopics as any).mockResolvedValue({ data: {} })

      await processRepoTopics(mockOctokit as any, repo, counts, false)

      const call = (mockOctokit.rest.repos.replaceAllTopics as any).mock.calls[0][0]
      expect(call.names).not.toContain('ghas-secret-0')
      expect(call.names).not.toContain('ghas-dependabot-0')
      expect(call.names).toContain('ghas-code-1')
    })

    it('removes existing GHAS topics when alert count drops to 0', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 0, codeScanning: 3, dependabot: 0 }

      ;(mockOctokit.rest.repos.getAllTopics as any).mockResolvedValue({
        data: { names: ['ghas-secret-5', 'ghas-dependabot-8', 'javascript'] }
      })
      ;(mockOctokit.rest.repos.replaceAllTopics as any).mockResolvedValue({ data: {} })

      await processRepoTopics(mockOctokit as any, repo, counts, false)

      const call = (mockOctokit.rest.repos.replaceAllTopics as any).mock.calls[0][0]
      expect(call.names).not.toContain('ghas-secret-5')
      expect(call.names).not.toContain('ghas-dependabot-8')
      expect(call.names).toContain('javascript')
      expect(call.names).toContain('ghas-code-3')
    })
  })
})
