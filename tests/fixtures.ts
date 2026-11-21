import seed from '../public/content.json'
import type { Content } from '../src/data/schema'

export function validContent(): Content {
  return JSON.parse(JSON.stringify(seed)) as Content
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
