package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	MODEL       = "gemini-2.5-flash"
	MAX_RETRIES = 3
	TIMEOUT_SEC = 240
)

var client = &http.Client{Timeout: TIMEOUT_SEC * time.Second}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		var n int
		fmt.Sscanf(v, "%d", &n)
		if n > 0 {
			return n
		}
	}
	return fallback
}

// ── Gemini API ────────────────────────────────────────────────────────────────

func callGemini(apiKey, prompt string) (string, error) {
	type Part struct{ Text string `json:"text"` }
	type Content struct{ Parts []Part `json:"parts"` }
	type GenConfig struct {
		Temperature     float64 `json:"temperature"`
		MaxOutputTokens int     `json:"maxOutputTokens"`
	}
	type Req struct {
		Contents         []Content `json:"contents"`
		GenerationConfig GenConfig `json:"generationConfig"`
	}
	type RespPart struct{ Text string `json:"text"` }
	type RespContent struct{ Parts []RespPart `json:"parts"` }
	type Candidate struct{ Content RespContent `json:"content"` }
	type APIErr struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	type Resp struct {
		Candidates []Candidate `json:"candidates"`
		Error      *APIErr     `json:"error,omitempty"`
	}

	body, _ := json.Marshal(Req{
		Contents:         []Content{{Parts: []Part{{Text: prompt}}}},
		GenerationConfig: GenConfig{Temperature: 0.1, MaxOutputTokens: 65536},
	})

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		MODEL, apiKey,
	)

	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	var r Resp
	if err := json.Unmarshal(raw, &r); err != nil {
		return "", fmt.Errorf("unmarshal: %w", err)
	}
	if r.Error != nil {
		return "", fmt.Errorf("api %d: %s", r.Error.Code, r.Error.Message)
	}
	if len(r.Candidates) == 0 || len(r.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response")
	}
	return r.Candidates[0].Content.Parts[0].Text, nil
}

var arrayRe = regexp.MustCompile(`(?s)\[.*\]`)

type MatchResult struct {
	ID      int      `json:"id"`
	Matches []string `json:"matches"`
}

func parseResults(text string) ([]MatchResult, error) {
	text = strings.ReplaceAll(text, "```json", "")
	text = strings.ReplaceAll(text, "```", "")
	match := arrayRe.FindString(strings.TrimSpace(text))
	if match == "" {
		return nil, fmt.Errorf("no JSON array in response")
	}
	var results []MatchResult
	return results, json.Unmarshal([]byte(match), &results)
}

// ── Chunk types ───────────────────────────────────────────────────────────────

type Chunk struct {
	Instructions string            `json:"_instructions"`
	Entries      []json.RawMessage `json:"entries"`
}

// ── Worker ────────────────────────────────────────────────────────────────────

type work struct {
	index        int
	total        int
	chunkFile    string
	responseFile string
}

func worker(jobs <-chan work, apiKey string, wg *sync.WaitGroup, mu *sync.Mutex, all *[]MatchResult) {
	defer wg.Done()

	for j := range jobs {
		data, err := os.ReadFile(j.chunkFile)
		if err != nil {
			fmt.Printf("  [%02d/%d] ✗ read error: %v\n", j.index, j.total, err)
			continue
		}

		var chunk Chunk
		if err := json.Unmarshal(data, &chunk); err != nil {
			fmt.Printf("  [%02d/%d] ✗ parse error: %v\n", j.index, j.total, err)
			continue
		}

		entriesJSON, _ := json.Marshal(chunk.Entries)
		prompt := chunk.Instructions + "\n\nHere are the entries:\n" + string(entriesJSON)

		var results []MatchResult
		var lastErr error

		for attempt := 1; attempt <= MAX_RETRIES; attempt++ {
			text, err := callGemini(apiKey, prompt)
			if err != nil {
				lastErr = err
				fmt.Printf("  [%02d/%d] attempt %d failed: %v — retrying in %ds...\n",
					j.index, j.total, attempt, err, attempt*3)
				time.Sleep(time.Duration(attempt*3) * time.Second)
				continue
			}

			results, err = parseResults(text)
			if err != nil {
				lastErr = err
				fmt.Printf("  [%02d/%d] attempt %d parse error: %v — retrying in %ds...\n",
					j.index, j.total, attempt, err, attempt*3)
				time.Sleep(time.Duration(attempt*3) * time.Second)
				continue
			}

			lastErr = nil
			break
		}

		if lastErr != nil {
			fmt.Printf("  [%02d/%d] ✗ FAILED after %d attempts: %v\n",
				j.index, j.total, MAX_RETRIES, lastErr)
			continue
		}

		out, _ := json.MarshalIndent(results, "", "  ")
		os.WriteFile(j.responseFile, out, 0644)

		mu.Lock()
		*all = append(*all, results...)
		mu.Unlock()

		fmt.Printf("  [%02d/%d] ✓ %s — %d matched\n",
			j.index, j.total, filepath.Base(j.chunkFile), len(results))
	}
}

// ── Import ────────────────────────────────────────────────────────────────────

type MIBEntry map[string]interface{}

func importResults(dir string, all []MatchResult) {
	mibPath := filepath.Join(dir, "metaphysical-bible-dictionary.json")
	data, _ := os.ReadFile(mibPath)

	var mib []MIBEntry
	json.Unmarshal(data, &mib)

	imported := 0
	for _, r := range all {
		if r.ID < 0 || r.ID >= len(mib) || len(r.Matches) == 0 {
			continue
		}
		mib[r.ID]["strongsNumbers"] = r.Matches
		lang := "Hebrew"
		if strings.HasPrefix(r.Matches[0], "G") {
			lang = "Greek"
		}
		mib[r.ID]["strongsLang"] = lang
		imported++
	}

	out, _ := json.MarshalIndent(mib, "", "  ")
	os.WriteFile(mibPath, out, 0644)

	withStrongs := 0
	for _, e := range mib {
		if _, ok := e["strongsNumbers"]; ok {
			withStrongs++
		}
	}

	fmt.Printf("\n  Imported : %d entries\n", imported)
	fmt.Printf("  Total    : %d/%d have Strong's numbers\n", withStrongs, len(mib))
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Println("ERROR: GEMINI_API_KEY not set")
		os.Exit(1)
	}

	concurrency := getEnvInt("CONCURRENCY", 5)
	rps         := getEnvInt("RPS", 3)

	dir, _ := filepath.Abs(filepath.Dir(os.Args[0]))

	chunkFiles, _ := filepath.Glob(filepath.Join(dir, "gemini-chunk-*.json"))
	sort.Strings(chunkFiles)

	if len(chunkFiles) == 0 {
		fmt.Println("No chunk files found.")
		os.Exit(1)
	}

	// Separate already-done from todo
	var todo []work
	var allResults []MatchResult
	var mu sync.Mutex

	for i, cf := range chunkFiles {
		rf := strings.Replace(cf, "gemini-chunk-", "gemini-response-", 1)
		if _, err := os.Stat(rf); err == nil {
			// Already done — load results immediately, no goroutine needed
			data, _ := os.ReadFile(rf)
			var res []MatchResult
			if json.Unmarshal(data, &res) == nil {
				allResults = append(allResults, res...)
			}
			fmt.Printf("  [%02d/%d] already done, skipping ✓\n", i+1, len(chunkFiles))
		} else {
			todo = append(todo, work{
				index:        i + 1,
				total:        len(chunkFiles),
				chunkFile:    cf,
				responseFile: rf,
			})
		}
	}

	if len(todo) == 0 {
		fmt.Println("\nAll chunks already done!")
	} else {
		fmt.Printf("\n══════════════════════════\n")
		fmt.Printf("  %d chunks to process\n", len(todo))
		fmt.Printf("  concurrency=%d  rps=%d\n", concurrency, rps)
		fmt.Printf("══════════════════════════\n\n")

		jobs    := make(chan work, len(todo))
		ticker  := time.NewTicker(time.Second / time.Duration(rps))
		defer ticker.Stop()

		// Start worker pool
		var wg sync.WaitGroup
		for w := 0; w < concurrency; w++ {
			wg.Add(1)
			go worker(jobs, apiKey, &wg, &mu, &allResults)
		}

		// Feed jobs with rate limiting
		for _, j := range todo {
			<-ticker.C
			jobs <- j
		}
		close(jobs)
		wg.Wait()
	}

	fmt.Println("\nImporting into MIB JSON...")
	importResults(dir, allResults)
	fmt.Println("\n✓ Done.")
}
