import { labelName, findExistingLabelByPrefix } from '../src/labels'

describe('labelName', () => {
  it('formats S prefix correctly', () => {
    expect(labelName('S', 5)).toBe('S-5')
  })

  it('formats C prefix correctly', () => {
    expect(labelName('C', 3)).toBe('C-3')
  })

  it('formats D prefix correctly', () => {
    expect(labelName('D', 10)).toBe('D-10')
  })

  it('handles zero count', () => {
    expect(labelName('S', 0)).toBe('S-0')
  })

  it('handles large counts', () => {
    expect(labelName('S', 9999)).toBe('S-9999')
  })
})

describe('findExistingLabelByPrefix', () => {
  it('finds existing label with matching prefix', () => {
    const labels = ['bug', 'S-5', 'enhancement']
    expect(findExistingLabelByPrefix(labels, 'S')).toBe('S-5')
  })

  it('returns undefined when no match', () => {
    const labels = ['bug', 'C-3', 'enhancement']
    expect(findExistingLabelByPrefix(labels, 'S')).toBeUndefined()
  })

  it('does not match partial prefix', () => {
    const labels = ['SA-5', 'SEC-10']
    expect(findExistingLabelByPrefix(labels, 'S')).toBeUndefined()
  })

  it('handles empty labels array', () => {
    expect(findExistingLabelByPrefix([], 'S')).toBeUndefined()
  })

  it('finds first matching label when multiple exist', () => {
    const labels = ['S-3', 'S-5']
    expect(findExistingLabelByPrefix(labels, 'S')).toBe('S-3')
  })

  it('matches exact pattern with dash and number', () => {
    const labels = ['S-prefix', 'S-10']
    expect(findExistingLabelByPrefix(labels, 'S')).toBe('S-10')
  })
})
