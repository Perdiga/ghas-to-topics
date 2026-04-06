import { jest } from '@jest/globals'
import { processRepoLabels } from '../src/labels'
import { Repository, LabelConfig, AlertCounts } from '../src/types'

const createMockOctokit = () => ({
  rest: {
    issues: { 
      getLabel: jest.fn(), 
      createLabel: jest.fn(), 
      updateLabel: jest.fn(), 
      listLabelsForRepo: jest.fn(),
      deleteLabel: jest.fn()
    },
  },
  paginate: {
    iterator: jest.fn()
  },
})

const mockLabelConfigs: LabelConfig[] = [
  { prefix: 'S', color: 'd73a4a', description: 'Secret scanning alert count' },
  { prefix: 'C', color: 'e4e669', description: 'Code scanning alert count' },
  { prefix: 'D', color: '0075ca', description: 'Dependabot alert count' }
]

describe('Integration Tests - End-to-End Flow', () => {
  describe('Scenario 1: Happy path - new labels on repo with alerts', () => {
    it('creates labels for repo with 5 security, 2 code, 10 Dependabot alerts', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = {
        security: 5,
        codeScanning: 2,
        dependabot: 10
      }

      // Mock: no existing labels
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { data: [] }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 })
      mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} })

      const labelsApplied = await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      expect(labelsApplied).toBe(3)
      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'test-org', repo: 'test-repo', name: 'S-5' })
      )
      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'test-org', repo: 'test-repo', name: 'C-2' })
      )
      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'test-org', repo: 'test-repo', name: 'D-10' })
      )
    })
  })

  describe('Scenario 2: Idempotency - re-running with same counts', () => {
    it('does not update labels when counts match existing labels', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = {
        security: 5,
        codeScanning: 2,
        dependabot: 10
      }

      // Mock: labels already exist with correct values
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { 
            data: [
              { name: 'S-5' },
              { name: 'C-2' },
              { name: 'D-10' }
            ] 
          }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.getLabel.mockResolvedValue({ data: { name: 'S-5' } })
      mockOctokit.rest.issues.updateLabel.mockResolvedValue({ data: {} })

      const labelsApplied = await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      // Labels already match, so updates are made but no deletions/creations
      expect(mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 3: Count changed - label needs update', () => {
    it('deletes old S-3 label and creates new S-7 label', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = {
        security: 7,
        codeScanning: 2,
        dependabot: 10
      }

      // Mock: old label S-3 exists
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { 
            data: [
              { name: 'S-3' },
              { name: 'C-2' },
              { name: 'D-10' }
            ] 
          }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.deleteLabel.mockResolvedValue({ data: {} })
      mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 })
      mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} })
      mockOctokit.rest.issues.updateLabel.mockResolvedValue({ data: {} })

      const labelsApplied = await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      expect(labelsApplied).toBeGreaterThan(0)
      expect(mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'test-org', repo: 'test-repo', name: 'S-3' })
      )
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
      const counts: AlertCounts = {
        security: 5,
        codeScanning: 2,
        dependabot: 10
      }

      // Mock: no existing labels
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { data: [] }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)

      const labelsApplied = await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        true  // dry-run mode
      )

      // Should still return count of labels that would be applied
      expect(labelsApplied).toBe(3)
      
      // Should NOT make label modification calls
      expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled()
      expect(mockOctokit.rest.issues.updateLabel).not.toHaveBeenCalled()
      expect(mockOctokit.rest.issues.deleteLabel).not.toHaveBeenCalled()
    })
  })

  describe('Scenario 5: Zero alert count - delete existing labels, skip creation', () => {
    it('does not create a label when count is 0 and no existing label', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = {
        security: 0,  // GHAS not enabled / no alerts
        codeScanning: 1,
        dependabot: 0
      }

      // Mock: no existing labels
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { data: [] }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 })
      mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} })

      await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      // S-0 and D-0 must NOT be created
      expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'S-0' })
      )
      expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'D-0' })
      )
      // C-1 should still be created
      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'C-1' })
      )
    })

    it('deletes existing label when alert count drops to 0', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = {
        security: 0,  // was 5, now resolved
        codeScanning: 3,
        dependabot: 0   // was 8, now resolved
      }

      // Mock: old labels S-5 and D-8 exist from a previous run
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { data: [{ name: 'S-5' }, { name: 'D-8' }] }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.deleteLabel.mockResolvedValue({ data: {} })
      mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 })
      mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} })

      const labelsApplied = await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      // S-5 and D-8 must be deleted
      expect(mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'S-5' })
      )
      expect(mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'D-8' })
      )
      // S-0 and D-0 must NOT be created
      expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'S-0' })
      )
      expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'D-0' })
      )
      // 2 deletions + 1 creation (C-3)
      expect(labelsApplied).toBe(3)
    })

    it('deletes existing S-0 label when count is still 0 (idempotent cleanup)', async () => {
      const mockOctokit = createMockOctokit()
      const repo: Repository = {
        name: 'test-repo',
        owner: 'test-org',
        full_name: 'test-org/test-repo',
        id: 1,
        archived: false,
        visibility: 'public'
      }
      const counts: AlertCounts = { security: 0, codeScanning: 0, dependabot: 0 }

      // Edge case: repo somehow has S-0 label from old behavior — must be cleaned up
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { data: [{ name: 'S-0' }] }
        }
      }
      mockOctokit.paginate.iterator.mockReturnValue(mockIterator)
      mockOctokit.rest.issues.deleteLabel.mockResolvedValue({ data: {} })

      await processRepoLabels(
        mockOctokit as any,
        repo,
        counts,
        mockLabelConfigs,
        false
      )

      expect(mockOctokit.rest.issues.deleteLabel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'S-0' })
      )
    })
  })
