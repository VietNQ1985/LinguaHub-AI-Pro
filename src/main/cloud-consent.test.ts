import { describe, expect, test } from 'vitest'
import { hasCloudConsentForTask } from './cloud-consent'

describe('ChatGPT cloud consent scopes', () => {
  test('manual content consent does not authorize background visible-chat translation', () => {
    expect(hasCloudConsentForTask('translateMessages', true, false)).toBe(false)
  })

  test('background visible-chat consent does not authorize manually submitted content', () => {
    expect(hasCloudConsentForTask('translate', false, true)).toBe(false)
  })

  test('each consent permits only its intended class of task', () => {
    expect(hasCloudConsentForTask('translateMessages', false, true)).toBe(true)
    expect(hasCloudConsentForTask('translate', true, false)).toBe(true)
  })
})
