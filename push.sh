git init

echo "node_modules/" > .gitignore
echo "dist/" >> .gitignore
echo "__pycache__/" >> .gitignore

git add .gitignore
git commit -m "chore: initialize repository and enforce ignore rules"

find . -type f -not -path "*/node_modules/*" -not -path "*/dist/*" -not -name ".gitignore" -not -path "*/.git/*" | while read -r file; do
  git add "$file"
  git commit -m "feat: integrate ${file#./}"
done
