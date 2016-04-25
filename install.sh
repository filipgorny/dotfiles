for D in ./themes/*; do
    if [ -d "${D}" ]; then
        ln -s $D /usr/share/themes/$D
    fi
done
