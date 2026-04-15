package com.llevame.app;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configurar barra de estado negra sólida
        setStatusBarBlack();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-aplicar en cada resume por si algo lo cambia
        setStatusBarBlack();
    }

    private void setStatusBarBlack() {
        Window window = getWindow();

        // Limpiar flags de transparencia
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

        // Habilitar dibujo del fondo de la barra del sistema
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // Establecer color negro
        window.setStatusBarColor(Color.BLACK);

        // Configurar iconos claros (blancos) en la barra de estado
        View decorView = window.getDecorView();
        int flags = decorView.getSystemUiVisibility();
        // Remover flag de iconos oscuros (para que sean blancos sobre fondo negro)
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        decorView.setSystemUiVisibility(flags);
    }
}
