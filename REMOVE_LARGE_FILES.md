# Removing Large Data Files from Git History

The large GeoJSON files are in your 3 unpushed commits. Here's how to remove them:

## Option 1: Interactive Rebase (Recommended)

1. Start an interactive rebase:
   ```bash
   git rebase -i origin/main
   ```

2. For each commit that has large files, change `pick` to `edit`

3. When the rebase stops at each commit:
   ```bash
   git rm --cached frontend/public/data/zipcodes/florida-zipcodes-all.json
   git rm --cached frontend/public/data/zipcodes/florida-zipcodes.geojson
   git rm --cached frontend/public/data/counties/florida-counties.json
   git commit --amend --no-edit
   git rebase --continue
   ```

4. Repeat for each commit

## Option 2: Using Git Bash or CMD

Run this in Git Bash (not PowerShell):

```bash
git filter-branch -f --index-filter "git rm --cached --ignore-unmatch frontend/public/data/zipcodes/florida-zipcodes-all.json frontend/public/data/zipcodes/florida-zipcodes.geojson frontend/public/data/counties/florida-counties.json" --prune-empty HEAD~3..HEAD
```

## Option 3: Using BFG Repo-Cleaner (Easiest)

1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
2. Run:
   ```bash
   java -jar bfg.jar --delete-files florida-zipcodes-all.json
   java -jar bfg.jar --delete-files florida-zipcodes.geojson
   java -jar bfg.jar --delete-files florida-counties.json
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

## After Removing Files

1. Verify files are removed:
   ```bash
   git log --oneline --name-only | grep -E "florida-zipcodes|florida-counties"
   ```

2. The `.gitignore` is already updated to prevent these files from being added again

3. You can now push:
   ```bash
   git push origin main
   ```

## Note

The files will remain on your local disk (they're just removed from git history). Your application will still work locally, but the large files won't be in the repository.

