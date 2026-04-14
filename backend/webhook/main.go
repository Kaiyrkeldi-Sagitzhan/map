package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
)

func main() {
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret == "" {
		log.Fatal("WEBHOOK_SECRET is not set")
	}

	deployPath := os.Getenv("DEPLOY_PATH")
	if deployPath == "" {
		deployPath = "/home/ask/map"
	}

	http.HandleFunc("/deploy", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		// Verify HMAC-SHA256 signature
		sig := r.Header.Get("X-Deploy-Signature")
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(sig), []byte(expected)) {
			log.Printf("Invalid signature from %s", r.RemoteAddr)
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		log.Println("Deploy triggered via webhook")
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte("Deploy started\n"))

		// Run rebuild in background
		go func() {
			cmd := exec.Command("bash", deployPath+"/build/rebuild.sh", "1")
			cmd.Dir = deployPath
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				log.Printf("Rebuild failed: %v", err)
			} else {
				log.Println("Rebuild complete")
			}
		}()
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok\n"))
	})

	log.Println("Webhook server listening on :9000")
	if err := http.ListenAndServe(":9000", nil); err != nil {
		log.Fatal(err)
	}
}
