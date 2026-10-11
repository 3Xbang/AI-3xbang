#!/bin/bash
sudo mv ~/temp-pd.js /var/www/construction/js/project-detail.js
sudo mv ~/temp-pm.js /var/www/construction/js/photo-manager.js
sudo mv ~/temp-app.js /var/www/construction/js/app.js
sudo chown -R nginx:nginx /var/www/construction/js/
echo "Deployed successfully"
