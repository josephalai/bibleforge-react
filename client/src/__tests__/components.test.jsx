import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from '../components/ThemeToggle'
import BibleViewer from '../components/BibleViewer'
import SearchResults from '../components/SearchResults'

describe('ThemeToggle', () => {
  it('renders moon icon in light mode', () => {
    render(<ThemeToggle theme="light" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('🌙')
  })

  it('renders sun icon in dark mode', () => {
    render(<ThemeToggle theme="dark" onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('☀️')
  })

  it('calls onToggle when clicked', () => {
    let called = false
    render(<ThemeToggle theme="light" onToggle={() => { called = true }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })
})

describe('BibleViewer', () => {
  const sampleVerses = [
    { id: 1001001, book: 1, chapter: 1, verse: 1, text: 'In the beginning God created the heaven and the earth.' },
    { id: 1001002, book: 1, chapter: 1, verse: 2, text: 'And the earth was without form, and void.' },
  ]

  it('shows loading state', () => {
    render(<BibleViewer loading={true} verses={[]} bookName="Genesis" chapter={1} totalChapters={50} onChapterChange={() => {}} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<BibleViewer loading={false} error="Something went wrong" verses={[]} bookName="Genesis" chapter={1} totalChapters={50} onChapterChange={() => {}} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders verses with chapter title', () => {
    render(<BibleViewer loading={false} verses={sampleVerses} bookName="Genesis" chapter={1} totalChapters={50} onChapterChange={() => {}} />)
    expect(screen.getByText('Genesis 1')).toBeInTheDocument()
    // Words are individually wrapped for click-to-define, so check individual words
    expect(screen.getByText('beginning')).toBeInTheDocument()
    expect(screen.getAllByText('the').length).toBeGreaterThan(0)
  })

  it('disables prev button on first chapter', () => {
    render(<BibleViewer loading={false} verses={sampleVerses} bookName="Genesis" chapter={1} totalChapters={50} onChapterChange={() => {}} />)
    expect(screen.getByLabelText('Previous chapter')).toBeDisabled()
    expect(screen.getByLabelText('Next chapter')).not.toBeDisabled()
  })

  it('disables next button on last chapter', () => {
    render(<BibleViewer loading={false} verses={sampleVerses} bookName="Genesis" chapter={50} totalChapters={50} onChapterChange={() => {}} />)
    expect(screen.getByLabelText('Next chapter')).toBeDisabled()
    expect(screen.getByLabelText('Previous chapter')).not.toBeDisabled()
  })
})

describe('SearchResults', () => {
  const books = [
    { id: 43, name: 'John' },
    { id: 45, name: 'Romans' },
  ]

  const results = {
    results: [
      { id: 43003016, book: 43, chapter: 3, verse: 16, text: 'For God so loved the world...' },
      { id: 45008028, book: 45, chapter: 8, verse: 28, text: 'And we know that all things work together for good...' },
    ],
  }

  it('shows search results with references', () => {
    render(<SearchResults results={results} query="love" books={books} onNavigate={() => {}} onBack={() => {}} loading={false} />)
    expect(screen.getByText(/Results for/)).toBeInTheDocument()
    expect(screen.getByText('2 verses found')).toBeInTheDocument()
    expect(screen.getByText('John 3:16')).toBeInTheDocument()
    expect(screen.getByText('Romans 8:28')).toBeInTheDocument()
  })

  it('shows no results message for empty search', () => {
    render(<SearchResults results={{ results: [] }} query="xyznonexistent" books={books} onNavigate={() => {}} onBack={() => {}} loading={false} />)
    expect(screen.getByText(/No verses matched/)).toBeInTheDocument()
  })

  it('calls onNavigate when a result is clicked', () => {
    let navigatedTo = null
    render(<SearchResults results={results} query="love" books={books} onNavigate={(b, c) => { navigatedTo = { b, c } }} onBack={() => {}} loading={false} />)
    fireEvent.click(screen.getByText('John 3:16').closest('[role="button"]'))
    expect(navigatedTo).toEqual({ b: 43, c: 3 })
  })
})
