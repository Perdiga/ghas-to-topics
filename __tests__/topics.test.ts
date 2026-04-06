import { topicName, findExistingTopicByPrefix } from '../src/topics'

describe('topicName', () => {
  it('formats ghas-secret prefix correctly', () => {
    expect(topicName('ghas-secret', 5)).toBe('ghas-secret-5')
  })

  it('formats ghas-code prefix correctly', () => {
    expect(topicName('ghas-code', 3)).toBe('ghas-code-3')
  })

  it('formats ghas-dependabot prefix correctly', () => {
    expect(topicName('ghas-dependabot', 10)).toBe('ghas-dependabot-10')
  })

  it('handles zero count', () => {
    expect(topicName('ghas-secret', 0)).toBe('ghas-secret-0')
  })

  it('handles large counts', () => {
    expect(topicName('ghas-secret', 9999)).toBe('ghas-secret-9999')
  })
})

describe('findExistingTopicByPrefix', () => {
  it('finds existing topic with matching prefix', () => {
    const topics = ['javascript', 'ghas-secret-5', 'security']
    expect(findExistingTopicByPrefix(topics, 'ghas-secret')).toBe('ghas-secret-5')
  })

  it('returns undefined when no match', () => {
    const topics = ['javascript', 'ghas-code-3', 'security']
    expect(findExistingTopicByPrefix(topics, 'ghas-secret')).toBeUndefined()
  })

  it('does not match partial prefix', () => {
    const topics = ['ghas-secret-scanning-5', 'ghas-secrets-10']
    expect(findExistingTopicByPrefix(topics, 'ghas-secret')).toBeUndefined()
  })

  it('handles empty topics array', () => {
    expect(findExistingTopicByPrefix([], 'ghas-secret')).toBeUndefined()
  })

  it('finds first matching topic when multiple exist', () => {
    const topics = ['ghas-secret-3', 'ghas-secret-5']
    expect(findExistingTopicByPrefix(topics, 'ghas-secret')).toBe('ghas-secret-3')
  })

  it('matches exact pattern with prefix, dash and number', () => {
    const topics = ['ghas-secret-prefix', 'ghas-secret-10']
    expect(findExistingTopicByPrefix(topics, 'ghas-secret')).toBe('ghas-secret-10')
  })
})
